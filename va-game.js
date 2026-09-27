// va-game.js
window.VA = window.VA || {};

VA.Game = {

  fromWorld(world) {
    const state = {
      version: 3,
      worldName: world.worldName,
      raceKey: world.raceKey,
      race: world.race,
      baseTL: world.baseTL,
      techs: { ...world.techs },
      turn: 1,
      resources: {
        essence: 20,
        ap: 10,
        materia: 5,
        knowledge: 5,
        influence: 2
      },
      storage: { ap: 0, materia: 0 },
      shards: world.shards.map((s, i) => ({
        idx: i + 1,
        size: s.size,
        name: s.name,
        area: s.area,
        maxPop: s.maxPop,
        factPop: s.factPop,
        loyalty: world.loyalty || 5,
        hasCapital: i === 0,
        buildings: [],
        troops: [],
        pendingGrowthBonus: 0
      })),
      researching: [],
      log: [],
      actionsThisTurn: { researched: [], builtThisTurn: [], hiredThisTurn: [] }
    };

    if (world.troops && world.troops.length > 0) {
      const capital = state.shards[0];
      world.troops.forEach(t => {
        capital.troops.push({ type: t.name, discontent: 0, free: true });
      });
    }

    this.recalcStorage(state);

    state.log.push({
      turn: 1,
      text: `Мир «${state.worldName}» основан. Раса: ${state.race.name}. Столица — ${state.shards[0].name}.`
    });

    return state;
  },

  recalcStorage(state) {
    let apCap = 0, matCap = 0;
    state.shards.forEach(s => {
      apCap += s.size * 2;
      matCap += s.size * 2;
      if (s.hasCapital) {
        apCap += VA.capital.bonuses.storageAp;
        matCap += VA.capital.bonuses.storageMat;
      }
      s.buildings.forEach(b => {
        const bonus = VA.storageBonus[b];
        if (bonus) {
          apCap += bonus.ap || 0;
          matCap += bonus.mat || 0;
        }
      });
    });
    state.storage.ap = apCap;
    state.storage.materia = matCap;
  },

  getWorldSize(state) {
    return state.shards.reduce((a, s) => a + s.size, 0);
  },

  nextTurn(state) {
    const log = [];

    // 1. Эссенция
    let essenceGain = 0;
    state.shards.forEach(s => {
      const filled = Math.min(1, s.factPop / (s.maxPop * 0.75));
      let e = s.size * filled * (s.loyalty / 5);
      if (state.raceKey === 'undead' || state.raceKey === 'angel') e += 0.5;
      if (['demon','crystal','shadow','mech'].includes(state.raceKey)) e -= 0.5;
      essenceGain += Math.max(0, e);
    });
    essenceGain = Math.round(essenceGain * 10) / 10;
    state.resources.essence = Math.min(
      state.resources.essence + essenceGain,
      this.getEssenceLimit(state)
    );
    log.push(`✨ +${essenceGain} Эссенции`);

    // 2. AP
    let apGain = 0, apUsed = 0;
    state.shards.forEach(s => {
      const effTL = Math.min(1 + (state.techs.food || 0), 6);
      const prod = VA.formulas.foodProduction(s.area, effTL);
      const cons = s.factPop / 100;
      const net = prod - cons;
      if (net > 0) apGain += net; else apUsed += -net;
    });
    apGain = Math.floor(apGain);
    apUsed = Math.floor(apUsed);
    const netAP = apGain - apUsed;
    state.resources.ap = Math.max(0, state.resources.ap + netAP);
    if (state.resources.ap > state.storage.ap) state.resources.ap = state.storage.ap;
    log.push(`🌾 AP: ${netAP >= 0 ? '+' : ''}${netAP}`);

    // 2b. Содержание отрядов
    const troopUpkeep = state.shards.reduce((a, s) =>
      a + s.troops.filter(t => !t.free).length, 0);
    if (troopUpkeep > 0) {
      if (state.resources.ap >= troopUpkeep) {
        state.resources.ap -= troopUpkeep;
        log.push(`🍖 −${troopUpkeep} AP`);
      } else {
        const shortfall = troopUpkeep - state.resources.ap;
        state.resources.ap = 0;
        log.push(`⚠️ Голод: не хватает ${shortfall} AP`);
        state.shards.forEach(s => {
          s.troops.forEach(t => {
            if (!t.free) t.discontent = (t.discontent || 0) + 1;
          });
          s.troops = s.troops.filter(t => {
            if (t.discontent >= 3) {
              log.push(`💀 Отряд ${t.type} дезертировал с ${s.name}`);
              return false;
            }
            return true;
          });
        });
      }
    }

    // 3. Материя
    let matGain = 0;
    state.shards.forEach(s => {
      const effTL = Math.min(1 + (state.techs.industry || 0), 6);
      const perBuilding = [1,2,3,5,8,12][effTL - 1] || 1;
      s.buildings.forEach(b => {
        if (['Шахта','Карьер','Лесопилка'].includes(b)) matGain += perBuilding;
        if (b === 'Металлургический комбинат') matGain += 2;
      });
    });
    state.resources.materia = Math.min(
      state.resources.materia + matGain,
      state.storage.materia
    );
    log.push(`⛏️ +${matGain} Материи`);

    // 4. Знание (база + по осколку + здания + Столица)
    const totalPop = state.shards.reduce((a, s) => a + s.factPop, 0);
    const baseKnowledge = Math.max(1, Math.floor(totalPop / 500));
    const perShardKnowledge = state.shards.length; // +1 Знание за каждый осколок
    let buildingKnowledge = 0;
    state.shards.forEach(s => {
      if (s.hasCapital) buildingKnowledge += VA.capital.bonuses.knowledge;
      s.buildings.forEach(b => {
        if (b === 'Башня учёного') buildingKnowledge += 2;
        if (b === 'Библиотека') buildingKnowledge += 3;
        if (b === 'Университет') buildingKnowledge += 4;
        if (b === 'Исследовательский институт') buildingKnowledge += 5;
        if (b === 'Академия наук') buildingKnowledge += 6;
      });
    });
    const knGain = baseKnowledge + perShardKnowledge + buildingKnowledge;
    state.resources.knowledge += knGain;
    log.push(`📚 +${knGain} Знаний (база ${baseKnowledge} + осколки ${perShardKnowledge} + здания ${buildingKnowledge})`);

    // 5. Влияние
    const baseInfluence = Math.max(0, Math.floor(totalPop / 1000));
    let buildingInfluence = 0;
    state.shards.forEach(s => {
      s.buildings.forEach(b => {
        if (b === 'Храм') buildingInfluence += 1;
        if (b === 'Священная роща') buildingInfluence += 1;
        if (b === 'Театр') buildingInfluence += 1;
        if (b === 'Академия искусств') buildingInfluence += 2;
      });
    });
    const infGain = baseInfluence + buildingInfluence;
    if (infGain > 0) {
      state.resources.influence += infGain;
      log.push(`👑 +${infGain} Влияния`);
    }

    // 6. Исследования
    const completed = [];
    state.researching = state.researching.filter(r => {
      r.turnsLeft--;
      if (r.turnsLeft <= 0) {
        state.techs[r.techId] = r.targetLevel;
        completed.push(r);
        return false;
      }
      return true;
    });
    if (completed.length > 0) {
      completed.forEach(r => {
        const name = VA.techs.find(t => t.id === r.techId)?.name || r.techId;
        log.push(`🔬 Завершено: ${name} → ур. ${r.targetLevel}`);
      });
    }
    if (state.researching.length > 0) {
      state.researching.forEach(r => {
        const name = VA.techs.find(t => t.id === r.techId)?.name || r.techId;
        log.push(`⏳ В работе: ${name} (ост. ${r.turnsLeft})`);
      });
    }

    // 7. Рост
    const baseGrowthRate = VA.formulas.growthRate(state.techs, state.race);
    let growthTotal = 0;
    state.shards.forEach(s => {
      const bonus = s.pendingGrowthBonus || 0;
      const rate = Math.max(0, baseGrowthRate + bonus);
      const delta = Math.round(s.factPop * rate);
      s.factPop = Math.min(s.maxPop, s.factPop + delta);
      growthTotal += delta;
      s.pendingGrowthBonus = 0;
    });
    log.push(`👥 +${growthTotal}`);

    state.actionsThisTurn = { researched: [], builtThisTurn: [], hiredThisTurn: [] };
    state.turn++;

    state.log.push({
      turn: state.turn,
      text: log.join(' · ')
    });
    if (state.log.length > 100) state.log.shift();

    return state;
  },

  getEssenceLimit(state) {
    const sizeSum = state.shards.reduce((a, s) => a + s.size, 0);
    const pop = state.shards.reduce((a, s) => a + s.factPop, 0);
    return sizeSum + Math.floor(pop / 1000) + 10;
  },

  getPeople(state) {
    const pop = state.shards.reduce((a, s) => a + s.factPop, 0);
    return VA.formulas.people(pop);
  },

  getUsedPeople(state) {
    return state.shards.reduce((a, s) =>
      a + s.troops.filter(t => !t.free).length, 0);
  },

  canResearch(state, techId) {
    const q = state.researching;
    const at = state.actionsThisTurn;

    if (q.find(r => r.techId === techId))
      return { ok: false, reason: 'Уже исследуется' };
    if (at.researched.find(r => r.techId === techId))
      return { ok: false, reason: 'Уже начато в этот ход' };

    if (at.researched.length >= 3)
      return { ok: false, reason: 'Макс. 3 технологии за ход' };

    const levelSum = at.researched.reduce((a, r) => a + r.levels, 0);
    if (levelSum >= 5)
      return { ok: false, reason: 'Макс. 5 уровней за ход' };

    const currentLevel = state.techs[techId] || 0;
    if (currentLevel >= 6)
      return { ok: false, reason: 'Максимальный уровень' };

    const cost = VA.formulas.techCost(currentLevel);
    if (state.resources.knowledge < cost.zn)
      return { ok: false, reason: `Нужно ${cost.zn} Знаний` };
    if (state.resources.essence < cost.el)
      return { ok: false, reason: `Нужно ${cost.el} Эссенции` };

    return { ok: true, cost };
  },

  research(state, techId) {
    const check = this.canResearch(state, techId);
    if (!check.ok) return check;

    const cost = check.cost;
    const currentLevel = state.techs[techId] || 0;

    state.resources.knowledge -= cost.zn;
    state.resources.essence -= cost.el;

    state.researching.push({
      techId,
      targetLevel: currentLevel + 1,
      turnsLeft: cost.time
    });
    state.actionsThisTurn.researched.push({ techId, levels: 1 });

    const techName = VA.techs.find(t => t.id === techId)?.name || techId;
    state.log.push({
      turn: state.turn,
      text: `🔬 Начато: ${techName} → ур. ${currentLevel + 1} (${cost.time} х.)`
    });
    return { ok: true };
  },

  build(state, shardIdx, buildingName, techId) {
    const shard = state.shards[shardIdx];
    if (!shard) return { ok: false, reason: 'Осколок не найден' };
    if (shard.buildings.length >= shard.size)
      return { ok: false, reason: 'Лимит зданий достигнут' };

    if ((state.techs[techId] || 0) < 1)
      return { ok: false, reason: 'Нужна технология (завершённая)' };

    const cost = { el: 3, mat: 2 };
    if (state.resources.essence < cost.el)
      return { ok: false, reason: `Нужно ${cost.el} Эссенции` };
    if (state.resources.materia < cost.mat)
      return { ok: false, reason: `Нужно ${cost.mat} Материи` };

    state.resources.essence -= cost.el;
    state.resources.materia -= cost.mat;
    shard.buildings.push(buildingName);
    this.recalcStorage(state);
    state.actionsThisTurn.builtThisTurn.push({ shardIdx, buildingName });
    state.log.push({
      turn: state.turn,
      text: `🏗️ Построено: ${buildingName} на ${shard.name}`
    });
    return { ok: true };
  },

  demolish(state, shardIdx, buildingName) {
    const shard = state.shards[shardIdx];
    if (!shard) return { ok: false, reason: 'Осколок не найден' };

    const idx = shard.buildings.indexOf(buildingName);
    if (idx === -1) return { ok: false, reason: 'Здание не найдено' };

    shard.buildings.splice(idx, 1);
    this.recalcStorage(state);

    state.log.push({
      turn: state.turn,
      text: `🔨 Снесено: ${buildingName} на ${shard.name}`
    });
    return { ok: true };
  },

  hire(state, shardIdx, troopName) {
    const shard = state.shards[shardIdx];
    if (!shard) return { ok: false, reason: 'Осколок не найден' };

    const people = this.getPeople(state);
    const used = this.getUsedPeople(state);
    if (used >= people) return { ok: false, reason: 'Нет свободных Людей' };

    const cost = { el: 2, mat: 1 };
    if (state.resources.essence < cost.el)
      return { ok: false, reason: `Нужно ${cost.el} Эссенции` };
    if (state.resources.materia < cost.mat)
      return { ok: false, reason: `Нужно ${cost.mat} Материи` };

    state.resources.essence -= cost.el;
    state.resources.materia -= cost.mat;
    shard.troops.push({ type: troopName, discontent: 0, free: false });
    state.actionsThisTurn.hiredThisTurn.push({ shardIdx, troopName });
    state.log.push({
      turn: state.turn,
      text: `⚔️ Нанят: ${troopName} на ${shard.name}`
    });
    return { ok: true };
  },

  disband(state, shardIdx, troopIndex) {
    const shard = state.shards[shardIdx];
    if (!shard) return { ok: false, reason: 'Осколок не найден' };
    const troop = shard.troops[troopIndex];
    if (!troop) return { ok: false, reason: 'Отряд не найден' };

    shard.troops.splice(troopIndex, 1);
    state.log.push({
      turn: state.turn,
      text: `🏳️ Распущен: ${troop.type} на ${shard.name}`
    });
    return { ok: true };
  },

  feast(state, shardIdx) {
    const shard = state.shards[shardIdx];
    if (!shard) return { ok: false, reason: 'Осколок не найден' };
    if (shard.loyalty >= 10)
      return { ok: false, reason: 'Лояльность уже максимальна' };

    const cost = this.getWorldSize(state) * VA.config.feastCostPerSize;
    if (state.resources.ap < cost)
      return { ok: false, reason: `Нужно ${cost} AP` };

    state.resources.ap -= cost;
    shard.loyalty = Math.min(10, shard.loyalty + 1);

    state.log.push({
      turn: state.turn,
      text: `🍷 Пир на ${shard.name}: −${cost} AP, лояльность → ${shard.loyalty}`
    });
    return { ok: true };
  },

  boostGrowth(state, shardIdx, apAmount) {
    const shard = state.shards[shardIdx];
    if (!shard) return { ok: false, reason: 'Осколок не найден' };
    if (apAmount < 1) return { ok: false, reason: 'Минимум 1 AP' };

    const current = shard.pendingGrowthBonus || 0;
    const maxBonus = VA.config.growthBoostMax;
    const perAP = VA.config.growthBoostPerAP;

    let allowed = apAmount;
    if (current + allowed * perAP > maxBonus) {
      allowed = Math.floor((maxBonus - current) / perAP);
    }
    if (allowed <= 0)
      return { ok: false, reason: `Потолок +${(maxBonus * 100).toFixed(1)}% достигнут` };

    const actualCost = allowed;
    if (state.resources.ap < actualCost)
      return { ok: false, reason: `Нужно ${actualCost} AP` };

    state.resources.ap -= actualCost;
    shard.pendingGrowthBonus = current + allowed * perAP;

    state.log.push({
      turn: state.turn,
      text: `🌱 Ускорение роста на ${shard.name}: −${actualCost} AP, +${(allowed * perAP * 100).toFixed(1)}%`
    });
    return { ok: true };
  }
};