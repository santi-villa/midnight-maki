/** Reproducible economy estimates from production data; no save or clock changes. */
import { readFileSync } from 'node:fs';
import ts from 'typescript';
async function data(path) {
  const source = readFileSync(new URL('../' + path, import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}
const { RECIPES, STARTER_RECIPES } = await data('src/data/recipes.ts');
const { ITEMS_BY_ID } = await data('src/data/items.ts');
const { BALANCE } = await data('src/core/balance.ts');
const { UPGRADES } = await data('src/restaurant/upgrades.ts');
const { ADVANCES } = await data('src/restaurant/progression.ts');
const { PROJECTS } = await data('src/data/projects.ts');
const cost = r => Object.entries(r.ingredients).reduce((sum, [id, n]) => sum + ITEMS_BY_ID[id].buy * n, 0);
const stocked = r => Object.keys(r.ingredients).every(id => ITEMS_BY_ID[id].buy > 0);
const freeRate = BALANCE.freeCookMultiplier ?? [0.6, 0.7, 0.8];
console.log('MARGINS (all ingredients bought; no tips, mastery, charm or variant)');
console.table(RECIPES.filter(stocked).map(r => ({ recipe: r.id, cost: cost(r), serviceWorst: Math.round(r.price * 0.9) - cost(r), serviceGood: Math.round(r.price * 1.1) - cost(r), freeOk: Math.round(r.price * freeRate[0]) - cost(r), freePerfect: Math.round(r.price * freeRate[2]) - cost(r) })));
console.log('XP MINIMUM ESTIMATES (quality good; 70% uniform + 30% highest 3 prices; no special/story recipes, drinks or tips). Levels 3+ require a manual ascent; days below measure XP only, not gathering or travel.');
let dishes = 0, net = 0, xpTotal = 0;
const unlocks = [];
for (let level = 1; level < 10; level++) {
  const known = RECIPES.filter(r => STARTER_RECIPES.includes(r.id) || r.unlock.level && r.unlock.level <= level);
  const top = [...known].sort((a, b) => b.price - a.price).slice(0, 3);
  const avg = fn => 0.7 * known.reduce((a, r) => a + fn(r), 0) / known.length + 0.3 * top.reduce((a, r) => a + fn(r), 0) / top.length;
  const count = BALANCE.restaurantXpPerLevel(level) / avg(r => r.xp + 2);
  dishes += count; net += count * avg(r => Math.round(r.price * 1.1) - cost(r));
  xpTotal += BALANCE.restaurantXpPerLevel(level);
  const ascent = ADVANCES.find(a => a.level === level + 1);
  net -= ascent?.coins ?? 0;
  unlocks.push({ level: level + 1, xpTotal, dishes: +dishes.toFixed(1), xpDaysAt6: +(dishes / 6).toFixed(1), xpDaysAt10: +(dishes / 10).toFixed(1), reputation: ascent?.reputation ?? 0, ascentCoins: ascent?.coins ?? 0, materials: Object.entries(ascent?.items ?? {}).map(([id, q]) => id + ':' + q).join(', '), netAfterAscents: Math.round(net) });
}
console.table(unlocks);
const early = RECIPES.filter(r => STARTER_RECIPES.includes(r.id) || r.unlock.level === 2);
const earlyProfit = early.reduce((n, r) => n + Math.round(r.price * 1.1) - cost(r), 0) / early.length;
console.log('UPGRADE SAVING (from zero, level 1–2 good dish margin, excluding errands and tips; later recipes earn more)');
console.table(UPGRADES.map(u => ({ upgrade: u.id, level: u.level, price: u.price, earlyDishes: +(u.price / earlyProfit).toFixed(1), materials: Object.entries(u.items ?? {}).map(([id, q]) => id + ':' + q).join(', '), friendship: u.friendship?.points ?? 0, needs: u.needs ?? '' })));
console.log('COST SINKS', { ascents: ADVANCES.reduce((n, a) => n + a.coins, 0), upgrades: UPGRADES.reduce((n, u) => n + u.price, 0), projectCoins: PROJECTS.reduce((n, p) => n + p.phases.reduce((a, s) => a + s.coins, 0), 0), projectStages: PROJECTS.reduce((n, p) => n + p.phases.length, 0) });
console.log('Estimates exclude travel, cooking durations, cancelled orders, errands, quests, free supplies, crops and story gates. Game days depend on actual dishes served; these are not measured real play times.');
