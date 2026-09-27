window.VA = window.VA || {};

VA.Game = {

  fromWorld(world) {
    const state = {
      version: 1,
      worldName: world.worldName,
      raceKey: world.raceKey,
      race: world.race,
      baseTL: world.baseTL,
      techs: { ...world.techs },
      turn: 1,
      seasonIdx: 0,
      seasons: ['🌱 Посев', '☀️ Лето', '🍂 Урожай', '❄️ Зима'],
      resources: {
        essence: 20,
        ap: 10,
        materia: 5,
        knowledge: 3,
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
        buildings: ['Ферма'],
        troops: []
      })),
      log: [],
      actionsThisTurn: { researched: [], builtThisTurn: [], hiredThisTurn: [] }
    };

    state.storage.ap = state.shards.reduce((a, s) => a + s.size * 2, 0);
    state.storage.materia = state.shards.reduce((a, s) => a + s.size * 2, 0);

    state.log.push({
      turn: 1, season: '🌱 Посев',
      text: `Мир «${state.worldName}» основан. Раса: ${state.race.name}.`
    });

    return state;
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
    if (state.resources.ap > state.storage.ap) {
      state.resources.ap = state.storage.ap;
    }
    log.push(`🌾 AP: ${netAP >= 0 ? '+' : ''}${netAP}`);

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

    // 4. Знание
    let knGain = 0;
    state.shards.forEach(s => {
      s.buildings.forEach(b => {
        if (b === 'Башня учёного') knGain += 1;
        if (b === 'Библиотека') knGain += 2;
        if (b === 'Университет') knGain += 3;
        if (b === 'Исследовательский институт') knGain += 4;
        if (b === 'Академия наук') knGain += 5;
      });
    });
    state.resources.knowledge += knGain;
    log.push(`📚 +${knGain} Знаний`);

    // 5. Рост населения
    const growthRate = VA.formulas.growthRate(state.techs, state.race);
    let growthTotal = 0;
    state.shards.forEach(s => {
      const delta = Math.round(s.factPop * growthRate);
      s.factPop = Math.min(s.maxPop, s.factPop + delta);
      growthTotal += delta;
    });
    log.push(`👥 +${growthTotal}`);

    // 6. Недовольство
    if (apUsed > apGain + state.resources.ap) {
      state.shards.forEach(s => {
        s.troops.forEach(t => {
          t.discontent = (t.discontent || 0) + 1;
          if (t.discontent >= 3) {
            log.push(`💀 Отряд ${t.type} дезертировал с ${s.name}`);
          }
        });
        s.troops = s.troops.filter(t => (t.discontent || 0) < 3);
      });
    }

    state.actionsThisTurn = { researched: [], builtThisTurn: [], hiredThisTurn: [] };

    state.seasonIdx = (state.seasonIdx + 1) % state.seasons.length;
    if (state.seasonIdx === 0) state.turn++;

    state.log.push({
      turn: state.turn,
      season: state.seasons[state.seasonIdx],
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
    return state.shards.reduce((a, s) => a + s.troops.length, 0);
  },

  canResearch(state, techId) {
    const at = state.actionsThisTurn;
    if (at.researched.find(r => r.techId === techId))
      return { ok: false, reason: 'Уже исследуется в этот ход' };

    if (at.researched.length >= 3)
      return { ok: false, reason: 'Макс. 3 технологии за ход' };

    const levelSum = at.researched.reduce((a, r) => a + r.levels, 0);
    if (levelSum >= 5)
      return { ok: false, reason: 'Макс. 5 уровней за ход' };

    const cost = VA.formulas.techCost(state.techs[techId] || 0);
    if (state.resources.knowledge < cost.zn)
      return { ok: false, reason: `Нужно ${cost.zn} Знаний` };
    if (state.resources.essence < cost.el)
      return { ok: false, reason: `Нужно ${cost.el} Эссенции` };

    return { ok: true, cost };
  },

  research(state, techId) {
    const check = this.canResearch(state, techId);
    if (!check.ok) return check;

    state.resources.knowledge -= check.cost.zn;
    state.resources.essence -= check.cost.el;
    state.techs[techId] = (state.techs[techId] || 0) + 1;
    state.actionsThisTurn.researched.push({ techId, levels: 1 });

    const techName = VA.techs.find(t => t.id === techId)?.name || techId;
    state.log.push({
      turn: state.turn, season: state.seasons[state.seasonIdx],
      text: `🔬 Изучено: ${techName} → ур. ${state.techs[techId]}`
    });
    return { ok: true };
  },

  build(state, shardIdx, buildingName, techId) {
    const shard = state.shards[shardIdx];
    if (!shard) return { ok: false, reason: 'Осколок не найден' };
    if (shard.buildings.length >= shard.size)
      return { ok: false, reason: 'Лимит зданий достигнут' };
    if ((state.techs[techId] || 0) < 1)
      return { ok: false, reason: 'Нужна технология' };

    const cost = { el: 3, mat: 2 };
    if (state.resources.essence < cost.el)
      return { ok: false, reason: `Нужно ${cost.el} Эссенции` };
    if (state.resources.materia < cost.mat)
      return { ok: false, reason: `Нужно ${cost.mat} Материи` };

    state.resources.essence -= cost.el;
    state.resources.materia -= cost.mat;
    shard.buildings.push(buildingName);
    state.actionsThisTurn.builtThisTurn.push({ shardIdx, buildingName });
    state.log.push({
      turn: state.turn, season: state.seasons[state.seasonIdx],
      text: `🏗️ Построено: ${buildingName} на ${shard.name}`
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
    shard.troops.push({ type: troopName, discontent: 0 });
    state.actionsThisTurn.hiredThisTurn.push({ shardIdx, troopName });
    state.log.push({
      turn: state.turn, season: state.seasons[state.seasonIdx],
      text: `⚔️ Нанят: ${troopName} на ${shard.name}`
    });
    return { ok: true };
  }
};