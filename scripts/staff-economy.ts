/** Reproducible estimate of the stage 2/3/8 economy: dishes per day, wages, supplies. Run: npx vite-node scripts/staff-economy.ts */
import { RECIPES } from '../src/data/recipes';
import { ITEMS_BY_ID } from '../src/data/items';
import { COOK_SECONDS, hireCost, trainCost, wageOf } from '../src/restaurant/staff';
import { demandFactor } from '../src/restaurant/townClients';

const OPEN_SECONDS = 14 * 60;            // 08:00-22:00 at one displayed minute per real second
const GAP = 30;                           // mean seconds between arrivals before demand
const PARTY = 0.5 * 1 + 0.3 * 2 + 0.15 * 3 + 0.05 * 4;
const cost = (r: (typeof RECIPES)[number]) => Object.entries(r.ingredients).reduce((n, [id, q]) => n + (ITEMS_BY_ID[id]?.buy ?? 0) * q, 0);
const early = RECIPES.filter((r) => (r.unlock?.level ? r.unlock.level <= 3 : r.unlock?.text === 'Inicial'));
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const price = avg(early.map((r) => r.price)), ing = avg(early.map(cost));
console.log(`recipes up to level 3: ${early.length}, mean price ${price.toFixed(1)}, mean bought-ingredient cost ${ing.toFixed(1)}`);

console.log('\ndemand (period, day, rain, rep):');
for (const [label, c] of [['morning weekday', { period: 0, day: 3 }], ['dusk weekend', { period: 2, day: 6 }], ['dusk rain', { period: 2, day: 3, rain: true }], ['famous dusk weekend', { period: 2, day: 6, reputation: 300, charm: 30, regulars: 4 }]] as const) {
  const d = demandFactor({ period: 1, day: 3, rain: false, reputation: 0, charm: 0, festival: false, regulars: 0, ...c });
  console.log(`  ${label.padEnd(20)} x${d.toFixed(2)} -> ${(OPEN_SECONDS / (GAP / d) * PARTY).toFixed(0)} customers/day`);
}
const avgDemand = avg([0.7, 1, 1.35, 1.1].map((p) => demandFactor({ period: 1, day: 3, rain: false, reputation: 0, charm: 0, festival: false, regulars: 0 }) * p));
const customers = OPEN_SECONDS / (GAP / avgDemand) * PARTY;
console.log(`\nmean day (no fame): about ${customers.toFixed(0)} customers`);

console.log('\ncook capacity per open day (one cook, working the whole shift):');
for (const kind of ['crew', 'hired'] as const) console.log(`  ${kind}: ` + COOK_SECONDS[kind].map((s, L) => `L${L} ${Math.floor(OPEN_SECONDS / s)}`).join(' · '));

console.log('\nwages per day / hire / training:');
for (const role of ['waiter', 'cook', 'cashier', 'helper'] as const) {
  console.log(`  ${role}: hire ${hireCost(role)}, wage ` + [0, 1, 2, 3, 4].map((level) => wageOf({ role, level } as never)).join('/') + ' | training to L' + [1, 2, 3, 4].map((l) => trainCost(l - 1)).join('/'));
}
const dishes = [10, 25, 50];
console.log('\nnet per day by dishes handled (price - ingredients, minus a hired cook at L0 wage):');
for (const n of dishes) console.log(`  ${n} dishes: gross ${(n * price).toFixed(0)}, margin ${(n * (price - ing)).toFixed(0)}, after cook wage ${(n * (price - ing) - wageOf({ role: 'cook', level: 0 } as never)).toFixed(0)}`);
