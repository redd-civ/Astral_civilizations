window.VA = window.VA || {};

VA.formulas = {
  maxPopulation: (area, tl) => Math.round(area * (VA.density[tl] || 175)),

  people: (pop) => Math.floor(pop * VA.config.peopleWorkRatio / VA.config.peopleDivisor),

  foodYield: (effTL) => {
    if (effTL <= 1) return 3;
    if (effTL === 2) return 6;
    if (effTL === 3) return 8;
    if (effTL === 4) return 10;
    if (effTL === 5) return 12;
    return 15;
  },

  fallowRatio: (effTL) => {
    if (effTL <= 2) return 0.5;
    if (effTL === 3) return 0.33;
    if (effTL === 4) return 0.25;
    return 0.2;
  },

  foodProduction: (area, effTL) => {
    const arable = area * VA.config.arableShare;
    const processed = arable * (1 - VA.formulas.fallowRatio(effTL));
    return processed * VA.formulas.foodYield(effTL);
  },

  essence: (size, loyalty) => size * (loyalty / VA.config.essenceLoyaltyDivider),

  storage: (size) => size * VA.config.storagePerSize,

  growthRate: (techs, race) => {
    if (race.artificial) return 0;
    let r = VA.config.baseGrowth;
    r += (techs.medicine || 0) * VA.config.medicineGrowthPerLevel;
    r += race.growthBonus || 0;
    return Math.max(0, r);
  },

  availableTroops: (techs) => VA.troops.filter(t => {
    const lvl = techs[t.req.tech] || 0;
    if (t.req.orTech) return lvl >= t.req.lvl || (techs[t.req.orTech] || 0) >= t.req.lvl;
    return lvl >= t.req.lvl;
  }),

  // Стоимость перехода на следующий уровень технологии
  techCost: (fromLvl) => {
    const costs = [
      { zn: 5,   el: 5,   time: 1 },
      { zn: 10,  el: 10,  time: 1 },
      { zn: 15,  el: 15,  time: 1 },
      { zn: 25,  el: 25,  time: 2 },
      { zn: 40,  el: 40,  time: 3 },
      { zn: 60,  el: 60,  time: 5 }
    ];
    return costs[fromLvl] || costs[costs.length - 1];
  }
};

VA.Engine = {
  buildShard(spec, ctx) {
    const { size, area, name } = spec;
    const { baseTL, loyalty, techs } = ctx;

    const maxPop = VA.formulas.maxPopulation(area, baseTL);
    const factPop = Math.round(maxPop * VA.config.filledRatio);
    const effTLFood = 1 + (techs.food || 0);
    const effTLInd = 1 + (techs.industry || 0);

    const foodProd = VA.formulas.foodProduction(area, effTLFood);
    const consumption = factPop / VA.config.apPerPeople;
    const netAP = Math.max(0, Math.floor(foodProd - consumption));

    const people = VA.formulas.people(factPop);
    const essence = VA.formulas.essence(size, loyalty);
    const storage = VA.formulas.storage(size);
    const mat = (techs.industry || 0) > 0 ? (techs.industry || 0) * 2 : 0;

    return {idx:0, size, name, area, maxPop, factPop, foodProd, consumption,
            netAP, people, essence, apStorage: storage, matStorage: storage,
            mat, effTLFood, effTLInd};
  },

  buildWorld(spec) {
    const shards = spec.shardSpecs.map((s, i) => {
      const sh = VA.Engine.buildShard(s, spec);
      sh.idx = i + 1;
      return sh;
    });

    const totalPop = shards.reduce((a,s)=>a+s.factPop,0);
    const totalPeople = shards.reduce((a,s)=>a+s.people,0);
    const totalEssence = shards.reduce((a,s)=>a+s.essence,0);
    const totalAP = shards.reduce((a,s)=>a+s.netAP,0);
    const totalAPStorage = shards.reduce((a,s)=>a+s.apStorage,0);
    const totalMatStorage = shards.reduce((a,s)=>a+s.matStorage,0);

    const growthRate = VA.formulas.growthRate(spec.techs, spec.race);
    const growthPeople = Math.round(totalPop * growthRate);
    const availTroops = VA.formulas.availableTroops(spec.techs);
    const troops = availTroops.slice(0, Math.min(spec.troopCount, totalPeople));

    return {...spec, shards, totalPop, totalPeople, totalEssence, totalAP,
            totalAPStorage, totalMatStorage, growthRate, growthPeople, troops,
            effTLFood: 1 + (spec.techs.food || 0),
            effTLInd: 1 + (spec.techs.industry || 0)};
  }
};
