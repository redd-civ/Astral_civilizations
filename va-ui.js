window.VA = window.VA || {};

VA.UI = {
  init() {
    const raceSel = document.getElementById('va-raceSel');
    raceSel.innerHTML = '<option value="random">🎲 Случайная</option>';
    Object.keys(VA.races).forEach(k => {
      const o = document.createElement('option');
      o.value = k; o.textContent = VA.races[k].name;
      raceSel.appendChild(o);
    });

    VA.UI.addShardSlot(2);
    VA.UI.addShardSlot(1);
    VA.UI.addShardSlot(3);
    VA.UI.rebuildTechDetail();
  },

  addShardSlot(sizeValue) {
    const list = document.getElementById('va-shardsList');
    if (list.children.length >= 10) { alert('Максимум 10 осколков'); return; }
    const opts = '<option value="random">🎲 Случайный</option>' +
      VA.sizes.map(s => `<option value="${s.size}" ${sizeValue===s.size?'selected':''}>${s.name} (${s.area} mi²)</option>`).join('');
    const div = document.createElement('div');
    div.className = 'va-shard-slot';
    div.innerHTML = `<button class="va-remove-btn" onclick="VA.UI.removeShardSlot(this)">×</button>
      <label>Осколок ${list.children.length + 1}</label>
      <select class="va-shard-size-sel">${opts}</select>`;
    list.appendChild(div);
    VA.UI.renumberShards();
  },

  removeShardSlot(btn) {
    const list = document.getElementById('va-shardsList');
    if (list.children.length <= 1) { alert('Нужен хотя бы один осколок'); return; }
    btn.parentElement.remove();
    VA.UI.renumberShards();
  },

  renumberShards() {
    const list = document.getElementById('va-shardsList');
    Array.from(list.children).forEach((slot, i) => {
      slot.querySelector('label').textContent = `Осколок ${i + 1}`;
    });
  },

  getShardSpecs() {
    const list = document.getElementById('va-shardsList');
    return Array.from(list.children).map(slot => {
      const v = slot.querySelector('.va-shard-size-sel').value;
      return v === 'random' ? VA.pickRandom(VA.sizes) : VA.sizes.find(x => x.size === parseInt(v));
    });
  },

  rebuildTechDetail() {
    const mode = document.getElementById('va-techMode').value;
    const detail = document.getElementById('va-techDetail');
    detail.innerHTML = '';
    if (mode === 'random') {
      detail.innerHTML = `<div class="va-tech-grid">
        <div class="va-tech-row"><label>Сколько:</label><input type="number" id="va-randTechCount" value="3" min="1" max="20"></div>
        <div class="va-tech-row"><label>Макс. ур.:</label><input type="number" id="va-randTechMax" value="2" min="1" max="6"></div>
      </div>`;
      return;
    }
    let html = '<div class="va-tech-grid">';
    VA.techs.forEach(t => {
      html += `<div class="va-tech-row"><label>${t.name}</label><input type="number" id="va-tech_${t.id}" value="0" min="0" max="6"></div>`;
    });
    html += '</div>';
    detail.innerHTML = html;
  },

  getTechs() {
    const mode = document.getElementById('va-techMode').value;
    const techs = {};
    VA.techs.forEach(t => techs[t.id] = 0);

    if (mode === 'random') {
      const n = Math.max(1, Math.min(20, parseInt(document.getElementById('va-randTechCount').value) || 3));
      const maxL = Math.max(1, Math.min(6, parseInt(document.getElementById('va-randTechMax').value) || 2));
      const shuffled = [...VA.techs].sort(() => Math.random() - 0.5);
      for (let i = 0; i < n; i++) techs[shuffled[i].id] = 1 + Math.floor(Math.random() * maxL);
    } else {
      VA.techs.forEach(t => {
        const el = document.getElementById('va-tech_' + t.id);
        techs[t.id] = el ? Math.max(0, Math.min(6, parseInt(el.value) || 0)) : 0;
      });
    }
    return techs;
  },

  generate() {
    const shardSpecs = VA.UI.getShardSpecs();
    const baseTL = parseInt(document.getElementById('va-baseTL').value);
    const raceKey = document.getElementById('va-raceSel').value;
    const techs = VA.UI.getTechs();
    const troopCount = Math.max(0, Math.min(10, parseInt(document.getElementById('va-troopCount').value) || 0));
    const loyalty = Math.max(0, Math.min(10, parseInt(document.getElementById('va-loyaltyVal').value) || 5));
    let worldName = document.getElementById('va-worldName').value.trim();

    const raceKeys = Object.keys(VA.races);
    const realRaceKey = raceKey === 'random' ? VA.pickRandom(raceKeys) : raceKey;
    const race = VA.races[realRaceKey];

    if (race.bonus && techs[race.bonus] !== undefined && techs[race.bonus] > 0) {
      techs[race.bonus] = Math.min(6, techs[race.bonus] + 1);
    }

    if (!worldName) {
      const word = ['Одного','Двух','Трёх','Четырёх','Пяти'][shardSpecs.length - 1] || shardSpecs.length;
      worldName = `Мир ${word} Осколков`;
    }

    const world = VA.Engine.buildWorld({
      shardSpecs, baseTL, loyalty, techs, race, raceKey: realRaceKey, troopCount, worldName
    });

    VA._lastWorld = world;
    VA.UI.render(world);
  },

  render(d) {
    const o = document.getElementById('va-output');
    const techCount = Object.values(d.techs).filter(v => v > 0).length;
    const maxLvl = Math.max(0, ...Object.values(d.techs));

    let html = `<h1>🌍 ${VA.escapeHtml(d.worldName)}</h1>`;
    html += `<div class="va-badges">
      <span class="va-badge">Осколков: ${d.shards.length}</span>
      <span class="va-badge">Раса: ${d.race.name}</span>
      <span class="va-badge">Технологий: ${techCount} · макс. ур. ${maxLvl}</span>
      <span class="va-badge">Отрядов: ${d.troops.length}</span>
      <span class="va-badge">Базовый TL: ${d.baseTL}</span>
    </div>`;

    html += `<div class="va-summary">
      <div class="va-stat"><div class="k">Население</div><div class="v">${VA.fmt(d.totalPop)}
        <small>+${(d.growthRate*100).toFixed(2)}% (+${d.growthPeople}/сезон)</small></div></div>
      <div class="va-stat"><div class="k">Люди</div><div class="v">${d.totalPeople}</div></div>
      <div class="va-stat"><div class="k">Эссенция</div><div class="v">${d.totalEssence.toFixed(1)}</div></div>
      <div class="va-stat"><div class="k">Чистый AP</div><div class="v">+${d.totalAP}</div></div>
      <div class="va-stat"><div class="k">Хранение AP</div><div class="v">${d.totalAPStorage}</div></div>
      <div class="va-stat"><div class="k">Знание/ход</div><div class="v">${Math.max(1, Math.floor(d.totalPop / 500))}</div></div>
    </div>`;

    html += `<div class="va-note">Заселённость ${VA.config.filledRatio*100}%, лояльность ${d.loyalty}.
      Эфф. TL Еды: <strong>${d.effTLFood}</strong>, Промышленности: <strong>${d.effTLInd}</strong>.
      Первый осколок — <strong>🏛️ Столица</strong> (+2 Знания, +10 хранение, бесплатные стартовые отряды).
      ${d.race.artificial ? 'Раса размножается искусственно.' : ''}</div>`;

    html += `<h2>Осколки</h2><div class="va-grid">`;
    d.shards.forEach(s => {
      const capitalBadge = s.idx === 1
        ? '<span class="va-tag" style="background:#c47a3c; color:#fff;">🏛️ Столица</span>'
        : `<span class="va-tag">Осколок ${VA.roman(s.idx)}</span>`;

      html += `<article class="va-card">
        <div class="va-orb va-${VA.orbClass(s.size)}"></div>
        ${capitalBadge}
        <h3>${s.name}</h3>
        <div class="va-rows">
          <div class="va-row"><span class="k">Площадь</span><span class="v">${s.area} mi²</span></div>
          <div class="va-row"><span class="k">Размер</span><span class="v">${s.size}</span></div>
          <div class="va-row"><span class="k">Макс. население</span><span class="v">${VA.fmt(s.maxPop)}</span></div>
          <div class="va-row"><span class="k">Факт. население</span><span class="v">${VA.fmt(s.factPop)}</span></div>
          <div class="va-row"><span class="k">Люди</span><span class="v">${s.people}</span></div>
          <div class="va-row"><span class="k">Эссенция</span><span class="v">${s.essence.toFixed(1)}</span></div>
          <div class="va-row"><span class="k">Чистый AP</span><span class="v">+${s.netAP}</span></div>
        </div>
      </article>`;
    });
    html += `</div>`;

    html += `<h2>Раса</h2>
    <div class="va-race-box">
      <div class="va-avatar">${d.race.icon}</div>
      <div>
        <h3 style="margin:0">${d.race.name}</h3>
        <div style="font-size:0.82rem;color:#6b5a44">Карма: <strong>${d.race.karma}</strong></div>
        <p style="margin-top:10px;font-size:0.92rem">${d.race.desc}</p>
        <div class="va-traits">${d.race.traits.map(t=>`<span class="va-trait">${t}</span>`).join('')}</div>
      </div>
    </div>`;

    html += `<h2>Технологии</h2>`;
    const known = VA.techs.filter(t => d.techs[t.id] > 0);
    if (known.length === 0) {
      html += `<div class="va-note">Ни одна технология не изучена.</div>`;
    } else {
      html += `<div class="va-grid">`;
      known.forEach(t => {
        const lvl = d.techs[t.id];
        let pips = '';
        for (let i = 0; i < 6; i++) pips += `<div class="va-pip ${i<lvl?'on':''}"></div>`;
        html += `<article class="va-card">
          <div class="va-tag">Технология</div>
          <h3>${t.name} — ур. ${lvl}</h3>
          <div class="va-pip-row">${pips}</div>
          <div class="va-rows" style="margin-top:14px">
            <div class="va-row"><span class="k">Эфф. TL</span><span class="v">${1 + lvl}</span></div>
          </div>
        </article>`;
      });
      html += `</div>`;
    }

    html += `<h2>Отряды воинов</h2>`;
    if (d.troops.length === 0) {
      html += `<div class="va-note">Нет доступных отрядов.</div>`;
    } else {
      html += `<div class="va-grid">`;
      d.troops.forEach((t, i) => {
        html += `<article class="va-card">
          <div class="va-unit">
            <div class="va-icon">${t.icon}</div>
            <div><h3 style="margin:0;font-size:1rem">Отряд ${VA.roman(i+1)}</h3>
              <div class="va-tag">Базовый · в Столице</div></div>
          </div>
          <div class="va-rows">
            <div class="va-row"><span class="k">Тип</span><span class="v">${t.name}</span></div>
            <div class="va-row"><span class="k">Найм</span><span class="v">бесплатно (стартовый)</span></div>
            <div class="va-row"><span class="k">Содержание</span><span class="v">0 (в Столице)</span></div>
          </div>
        </article>`;
      });
      html += `</div>`;
    }

    html += `<div style="text-align:center; margin-top:30px;">
      <button class="va-gen-btn" onclick="VA.UI.startGame()" style="font-size:1.15rem; padding:16px 40px;">
        ⚔️ Сохранить и начать игру
      </button>
    </div>`;

    html += `<footer style="margin-top:40px;text-align:center;font-size:0.78rem;color:#6b5a44">
      ${VA.escapeHtml(d.worldName)} · ${d.race.name} · ${techCount} технологий · ${d.troops.length} отрядов</footer>`;

    o.innerHTML = html;
    o.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  startGame() {
    if (!VA._lastWorld) { alert('Сначала сгенерируйте мир'); return; }
    const state = VA.Game.fromWorld(VA._lastWorld);
    VA.Storage.save(state);
    window.location.href = 'game.html';
  }
};

document.addEventListener('DOMContentLoaded', () => VA.UI.init());