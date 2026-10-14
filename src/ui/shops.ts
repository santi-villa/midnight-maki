/** Shops: buy ingredients, seeds, furniture, clothes, floor & wall styles; sell collectibles. */
import { iconElement } from '../art/icons';
import { drawObject } from '../art/objects';
import { FLOOR_STYLES, WALL_STYLES } from '../art/tiles';
import { audio } from '../audio/audio';
import { bus } from '../core/events';
import { game } from '../core/state';
import { CLOTHES, CLOTHES_BY_ID } from '../data/clothes';
import { FURNITURE, FURN_BY_ID } from '../data/furniture';
import { ITEMS_BY_ID, type ItemCat } from '../data/items';
import { runScene, say } from '../dialogue/dialogue';
import { shopGate } from '../systems/npcs';
import { shopInteractionText } from '../systems/schedule';
import { previewCanvas } from './creator';
import { h, panel, toast } from './dom';

type Entry = { kind: 'item' | 'furn' | 'cloth' | 'floor' | 'wall'; id: string; price: number };

interface ShopDef {
  title: string;
  keeper?: string;
  greet: string;
  tabs: { name: string; list: () => Entry[] }[];
  sell?: ItemCat[];
  open?: () => boolean;
  closedMsg?: string;
}

const items = (ids: string[], mult = 1): Entry[] => ids.map((id) => ({ kind: 'item', id, price: Math.ceil((ITEMS_BY_ID[id]?.buy || ITEMS_BY_ID[id]?.sell * 3 || 10) * mult) }));
const furn = (shop: string) => FURNITURE.filter((f) => f.shop === shop && f.price > 0 && (!f.unlock || game.has(f.unlock))).map((f) => ({ kind: 'furn' as const, id: f.id, price: f.price }));
const clothes = (shop: string) => CLOTHES.filter((c) => c.shop === shop && c.price > 0 && !game.save.clothesOwned.includes(c.id) && (!c.unlock || game.has(c.unlock))).map((c) => ({ kind: 'cloth' as const, id: c.id, price: c.price }));
const styles = (): Entry[] => [
  ...Object.entries(FLOOR_STYLES).filter(([k, s]) => s.price > 0 && !game.has('floor_' + k)).map(([k, s]) => ({ kind: 'floor' as const, id: k, price: s.price })),
  ...Object.entries(WALL_STYLES).filter(([k, s]) => s.price > 0 && !game.has('wall_' + k)).map(([k, s]) => ({ kind: 'wall' as const, id: k, price: s.price })),
];

export const SHOPS: Record<string, ShopDef> = {
  taro: {
    title: 'Almacén de Taro', keeper: 'taro', greet: '¡{Bienvenido|Bienvenida}! Arroz, nori, muebles y rumores. Lo último es gratis.',
    tabs: [
      { name: 'Ingredientes', list: () => items(['rice', 'nori', 'salmon', 'tuna', 'cucumber', 'avocado', 'egg', 'shrimp', 'crab', 'cream', 'sesame', 'wasabi', 'chili', 'tempura', 'mango', 'eel', 'roe', 'scallion', 'carrot', 'ginger', 'umeboshi', 'tea_leaves', 'ramune_bottle', 'milk', 'berry']) },
      { name: 'Semillas', list: () => items(['sd_scallion', 'sd_cucumber', 'sd_carrot', 'sd_chili', 'sd_flower', ...(game.has('unlock_garden') ? ['sd_sakura'] : [])]) },
      { name: 'Muebles', list: () => furn('taro') },
      { name: 'Pisos y paredes', list: styles },
      { name: 'Regalos', list: () => items(['g_candy', 'g_tea', 'g_blanket', 'g_book', 'g_hotsauce']) },
    ],
    sell: ['fish', 'flower', 'shell', 'material', 'bug', 'ingredient'],
  },
  yuki: {
    title: 'Tienda de Yuki', keeper: 'yuki', greet: 'Pasá, pasá. Todo hecho a mano. Bueno, casi todo.',
    tabs: [
      { name: 'Ropa', list: () => clothes('yuki').filter((c) => ['top', 'bottom', 'shoes'].includes(CLOTHES_BY_ID[c.id].slot)) },
      { name: 'Accesorios', list: () => clothes('yuki').filter((c) => !['top', 'bottom', 'shoes'].includes(CLOTHES_BY_ID[c.id].slot)) },
    ],
  },
  bento: {
    title: 'Panadería de Bento', keeper: 'bento', greet: '¡Pan de leche recién salido! Y dulces para regalar.',
    tabs: [{ name: 'Mostrador', list: () => items(['g_candy', 'g_tea', 'egg', 'berry'], 1) }],
  },
  nami: {
    title: 'Puesto de pescado', keeper: 'nami', greet: '¡Fresquito del mar! Y si pescaste algo, te lo compro.',
    tabs: [{ name: 'Pescado', list: () => items(['salmon', 'tuna', 'shrimp', 'eel', 'roe', 'crab'], 0.9) }],
    sell: ['fish'],
  },
  shells: {
    title: 'Puesto de conchas', greet: 'Conchas, vidrios de mar y collares.',
    tabs: [{ name: 'Puesto', list: () => clothes('yuki').filter((c) => c.id === 'ex_necklace') }],
    sell: ['shell', 'material'],
  },
  sumi: {
    title: 'Puesto de Sumi', keeper: 'sumi', greet: 'Cuadros, atriles y cosas lindas para tus paredes.',
    tabs: [{ name: 'Arte y deco', list: () => furn('sumi') }],
  },
  market_food: {
    title: 'Dulces de luna', greet: 'Perlas de luna, carambolas y caramelos brillantes.',
    tabs: [{ name: 'Puesto', list: () => [...items(['moonpearl', 'starfruit'], 1), ...items(['g_candy'], 0.8)].map((e) => ({ ...e, price: e.id === 'moonpearl' ? 22 : e.id === 'starfruit' ? 18 : e.price })) }],
  },
  market_rare: {
    title: 'Objetos raros', greet: 'Cosas que no se ven de día...',
    tabs: [{ name: 'Rarezas', list: () => [...items(['st_amethyst', 'st_quartz', 'sd_sakura'], 1).map((e) => ({ ...e, price: e.id === 'sd_sakura' ? 30 : 45 })), ...furn('market')] }],
  },
  market_clothes: {
    title: 'Ropa de luna', greet: 'Prendas tejidas con hilo de noche.',
    tabs: [{ name: 'Prendas', list: () => [...clothes('market'), ...CLOTHES.filter((c) => c.style === 'gothic' && c.price > 0 && !game.save.clothesOwned.includes(c.id)).map((c) => ({ kind: 'cloth' as const, id: c.id, price: Math.round(c.price * 0.9) }))] }],
  },
  market_furn: {
    title: 'Decoración nocturna', greet: 'Lámparas de estrella, telescopios, alfombras de noche.',
    tabs: [{ name: 'Deco', list: () => furn('market') }],
  },
};
if (SHOPS.sumi) SHOPS.mika = SHOPS.sumi; // legacy save compatibility alias

function entryInfo(e: Entry): { name: string; icon: HTMLElement; desc: string; owned: number } {
  if (e.kind === 'item') {
    const it = ITEMS_BY_ID[e.id];
    return { name: it.name, icon: iconElement(it.icon), desc: it.desc, owned: game.count(e.id) };
  }
  if (e.kind === 'furn') {
    const f = FURN_BY_ID[e.id];
    const c = drawObject(f.kind, f.w * 16, f.sh, f.c1, f.c2 || f.c1, f.variant ?? 0);
    c.style.cssText = `width:${Math.min(56, f.w * 28)}px;image-rendering:pixelated`;
    const placed = Object.values(game.save.decor).flat().filter((p) => p.id === e.id).length;
    return { name: f.name, icon: c, desc: `${f.w}×${f.h} · estilo ${f.style}`, owned: (game.save.furnitureOwned[e.id] ?? 0) + placed };
  }
  if (e.kind === 'cloth') {
    const c = CLOTHES_BY_ID[e.id];
    const look = { ...game.save.player.appearance, [c.slot]: c.id };
    const cv = previewCanvas(look, ['down'], 2);
    return { name: c.name, icon: cv, desc: `Estilo ${c.style}`, owned: game.save.clothesOwned.includes(e.id) ? 1 : 0 };
  }
  if (e.kind === 'floor') {
    const s = FLOOR_STYLES[e.id];
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    const g = c.getContext('2d')!;
    s.draw(g, 0, 0, Math.random);
    c.style.cssText = 'width:40px;height:40px;image-rendering:pixelated';
    return { name: 'Piso: ' + s.name, icon: c, desc: 'Se aplica desde Decorar', owned: game.has('floor_' + e.id) ? 1 : 0 };
  }
  const w = WALL_STYLES[e.id];
  return { name: 'Pared: ' + w.name, icon: h('div', { style: { width: '40px', height: '40px', background: w.base, border: `4px solid ${w.accent}`, borderRadius: '6px' } }), desc: 'Se aplica desde Decorar', owned: game.has('wall_' + e.id) ? 1 : 0 };
}

function buy(e: Entry, qty = 1): boolean {
  const total = e.price * qty;
  if (!game.spend(total, 'shop')) {
    toast('No te alcanzan las monedas.');
    audio.sfxPlay('error');
    return false;
  }
  if (e.kind === 'item') game.addItem(e.id, qty, 'shop');
  else if (e.kind === 'furn') game.save.furnitureOwned[e.id] = (game.save.furnitureOwned[e.id] ?? 0) + qty;
  else if (e.kind === 'cloth') game.save.clothesOwned.push(e.id);
  else game.setFlag(`${e.kind}_${e.id}`);
  game.stat('purchases');
  game.touch('buy');
  audio.sfxPlay('coin');
  return true;
}

export async function openShop(id: string) {
  const s = SHOPS[id];
  if (!s) return;
  const canTrade = (notify = true): boolean => {
    const gate = shopGate(id);
    const detail = gate.tracked && !gate.open ? gate.detail : s.open && !s.open() ? s.closedMsg ?? 'Está cerrado ahora.' : '';
    if (detail && notify) toast(detail);
    return !detail;
  };
  if (!canTrade()) return;
  if (s.keeper && !game.has('met_shop_' + id)) {
    game.setFlag('met_shop_' + id);
    await runScene('shop_' + id, async () => {
      await say(s.keeper!, s.greet, 'happy');
    });
    game.addFriendship(s.keeper, 4);
  }
  if (!canTrade()) return; // the greeting may have yielded while service changed
  const hours = h('p', { class: 'hint' });
  const body = h('div');
  const coins = h('span', { class: 'coin' });
  const tabNames = [...s.tabs.map((t) => t.name), ...(s.sell ? ['Vender'] : [])];
  let current = 0;
  let serviceKey = '';
  // fitting room: tap clothes to try them on before buying
  const tryLook = { ...game.save.player.appearance };
  const fitPreview = h('div', { class: 'fit-preview' });
  const fitInfo = h('div', { class: 'hint' }, 'Tocá una prenda para probártela.');
  const drawFit = () => {
    fitPreview.innerHTML = '';
    fitPreview.append(previewCanvas(tryLook, ['down', 'right', 'up'], 3));
  };
  const fitting = h('div', { class: 'fitting card' }, fitPreview, h('div', { class: 'col', style: { gap: '6px' } }, h('b', null, 'Probador'), fitInfo,
    h('button', { class: 'btn small', onclick: () => { Object.assign(tryLook, game.save.player.appearance); fitInfo.textContent = 'Volviste a tu ropa.'; drawFit(); } }, 'Mi ropa')));
  drawFit();
  const tryOn = (id: string) => {
    const c = CLOTHES_BY_ID[id];
    (tryLook as any)[c.slot] = c.id;
    fitInfo.textContent = `Probándote: ${c.name}`;
    audio.sfxPlay('tap');
    drawFit();
  };
  const wear = (id: string) => {
    const c = CLOTHES_BY_ID[id];
    (game.save.player.appearance as any)[c.slot] = c.id;
    game.touch('wear');
    bus.emit('appearance:changed', {});
    toast(`Te pusiste: ${c.name}`);
  };
  const render = () => {
    serviceKey = serviceStamp();
    const trading = canTrade(false);
    hours.textContent = shopInteractionText(shopGate(id));
    coins.textContent = `${game.coins} monedas`;
    body.innerHTML = '';
    if (current >= s.tabs.length) return renderSell();
    const list = s.tabs[current].list();
    if (list.some((e) => e.kind === 'cloth')) body.append(fitting);
    const grid = h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' } });
    if (!list.length) grid.append(h('p', { class: 'muted' }, '¡Ya tenés todo de acá!'));
    for (const e of list) {
      const info = entryInfo(e);
      const single = e.kind === 'cloth' || e.kind === 'floor' || e.kind === 'wall';
      const slot = h('div', { class: 'slot', title: info.desc, onclick: (ev: Event) => { if (e.kind === 'cloth' && !(ev.target as HTMLElement).closest('button')) tryOn(e.id); } },
          info.owned ? h('span', { class: 'qty' }, single ? '✓' : info.owned) : null,
          info.icon,
          h('span', null, info.name),
          h('span', { class: 'price' }, `${e.price} ●`),
          h('div', { class: 'row', style: { gap: '4px' } },
            h('button', { class: 'btn small', disabled: !trading || game.coins < e.price, onclick: () => { if (!canTrade()) { render(); return; } if (buy(e)) { if (e.kind === 'cloth') wear(e.id); render(); } } }, e.kind === 'cloth' ? 'Comprar y poner' : 'Comprar'),
            e.kind === 'item' ? h('button', { class: 'btn small', disabled: !trading || game.coins < e.price * 5, onclick: () => { if (!canTrade()) { render(); return; } if (buy(e, 5)) render(); } }, '×5') : null));
      grid.append(slot);
    }
    body.append(grid);
  };
  const renderSell = () => {
    const sellable = Object.keys(game.save.inventory).filter((id) => s.sell!.includes(ITEMS_BY_ID[id]?.cat) && (ITEMS_BY_ID[id]?.sell ?? 0) > 0);
    const grid = h('div', { class: 'grid' });
    if (!sellable.length) grid.append(h('p', { class: 'muted' }, 'No tenés nada que te compren acá.'));
    for (const id of sellable) {
      const it = ITEMS_BY_ID[id];
      grid.append(h('div', { class: 'slot' }, h('span', { class: 'qty' }, game.count(id)), iconElement(it.icon), h('span', null, it.name), h('span', { class: 'price' }, `${it.sell} ●`), h('button', { class: 'btn small', disabled: !canTrade(false), onclick: () => { if (!canTrade()) { render(); return; } if (game.removeItem(id, 1)) { game.addCoins(it.sell, 'sell'); audio.sfxPlay('coin'); render(); } } }, 'Vender')));
    }
    body.append(h('p', { class: 'hint' }, 'Lo que ya registraste en tu colección queda guardado aunque lo vendas.'), grid);
  };
  const bar = h('div', { class: 'tabs' });
  const btns = tabNames.map((n, i) => h('button', { class: 'tab' + (i === 0 ? ' active' : ''), onclick: () => { current = i; btns.forEach((b, j) => b.classList.toggle('active', j === i)); render(); } }, n));
  bar.append(...btns);
  render();
  function serviceStamp() {
    const gate = shopGate(id);
    return `${gate.phase}:${gate.open}:${gate.detail}:${canTrade(false)}`;
  }
  const refreshService = () => {
    const key = serviceStamp();
    if (key === serviceKey) return;
    serviceKey = key;
    render();
  };
  const off = [bus.on('time:changed', refreshService), bus.on('state:changed', refreshService)];
  panel({ title: s.title, wide: true, tabs: bar, body: h('div', null, hours, h('div', { style: { marginBottom: '8px' } }, coins), body), onClose: () => { for (const unhook of off) unhook(); } });
}
