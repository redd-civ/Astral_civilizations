window.VA = window.VA || {};

VA.troops = [
  {name:'Лёгкая пехота',  icon:'🗡️', req:{tech:'melee',   lvl:1}},
  {name:'Лучники',        icon:'🏹', req:{tech:'range',   lvl:1}},
  {name:'Тяжёлая пехота', icon:'🛡️', req:{tech:'melee',   lvl:3}},
  {name:'Кавалерия',      icon:'🐎', req:{tech:'animal',  lvl:3}},
  {name:'Артиллерия',     icon:'💣', req:{tech:'range',   lvl:5}},
  {name:'Боевые маги',    icon:'🔮', req:{tech:'alchemy', lvl:3, orTech:'artifact'}}
];