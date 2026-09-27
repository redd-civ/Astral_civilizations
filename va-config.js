window.VA = window.VA || {};

VA.config = {
  arableShare: 0.75,
  apPerPeople: 100,
  peopleDivisor: 250,
  peopleWorkRatio: 0.6,
  filledRatio: 0.75,
  baseGrowth: 0.01,               // базовый прирост 1% за ход
  medicineGrowthPerLevel: 0.002,  // +0.2% за уровень Медицины
  essenceLoyaltyDivider: 5,
  storagePerSize: 2,
  feastCostPerSize: 1,            // пир: 1 AP × размер мира
  growthBoostPerAP: 0.005,        // +0.5% за 1 AP
  growthBoostMax: 0.02            // потолок +2% за ход (4 AP)
};

VA.sizes = [
  {size:1,  name:'Крохотный',    area:2},
  {size:2,  name:'Маленький',    area:3.3},
  {size:3,  name:'Небольшой',    area:5.5},
  {size:5,  name:'Средний',      area:9.1},
  {size:9,  name:'Большой',      area:15.2},
  {size:15, name:'Огромный',     area:25.2},
  {size:26, name:'Титанический', area:41.8},
  {size:43, name:'Колоссальный', area:69.5}
];

VA.density = {1:125, 2:175, 3:275, 4:450, 5:725};

// ==================== ХЕЛПЕРЫ ====================
VA.pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
VA.fmt = (n) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
VA.escapeHtml = (s) => s.replace(/[&<>"']/g, c => (
  {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
));
VA.roman = (n) => ['','I','II','III','IV','V','VI','VII','VIII','IX','X'][n] || n;
VA.orbClass = (size) => size <= 1 ? 'tiny' : size <= 3 ? 'small' : size <= 9 ? 'medium' : 'large';