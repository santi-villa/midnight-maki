/** Slot picker shared by the title and the in-game menu. */
import { SEASONS, WEEKDAYS, dayOfSeason, seasonOf, weekday } from '../core/balance';
import type { SaveData } from '../core/types';
import { adoptSnapshot, listSlots, loadGame, markResumeOnce, type SaveBrief, type SlotInfo } from '../persistence/storage';
import { confirmBox, h, panel, toast } from './dom';
import { formatHudTime, hudTime } from './hudClock';

export function slotTitle(slot: number): string {
  return `Partida ${slot + 1}`;
}

export function describeBrief(brief: SaveBrief): string {
  const day = brief.day;
  const date = `${WEEKDAYS[weekday(day)]} ${dayOfSeason(day)} de ${SEASONS[seasonOf(day)]}`;
  const clock = formatHudTime(hudTime(brief.period, brief.minutes));
  return [brief.name, brief.restaurant, date, clock, `${brief.coins} monedas`].filter(Boolean).join(' · ');
}

const choiceStyle = {
  width: '100%',
  textAlign: 'left',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '2px',
};

function choiceButton(label: string, hint: string, onClick: () => void): HTMLButtonElement {
  return h('button', { type: 'button', class: 'btn', style: choiceStyle, onclick: onClick }, h('span', null, label), h('span', { class: 'hint', style: { fontWeight: '400' } }, hint)) as HTMLButtonElement;
}

/** Automatic and manual snapshots for every slot. Empty slots say so. */
export async function loadChoiceList(onPick: (slot: number, kind: 'auto' | 'manual') => void): Promise<HTMLElement> {
  const slots = await listSlots();
  const col = h('div', { class: 'col' });
  col.append(h('p', { class: 'hint' }, 'Cada partida puede tener un guardado automático, con el último progreso, y uno manual, el punto fijo.'));
  for (const info of slots) {
    const body = h('div', { class: 'col' });
    if (!info.auto && !info.manual) body.append(h('p', { class: 'hint', style: { margin: '0' } }, 'Vacía · Empezar una nueva aventura'));
    for (const brief of [info.auto, info.manual]) {
      if (!brief) continue;
      const label = brief.kind === 'auto' ? 'Automático' : 'Manual';
      body.append(choiceButton(`${label} · ${brief.name} · día ${brief.day}`, describeBrief(brief), () => onPick(info.slot, brief.kind)));
    }
    col.append(h('div', { class: 'card col' }, h('b', null, slotTitle(info.slot)), body));
  }
  return col;
}

/** One button per slot, used when starting or importing a playthrough. */
export async function slotChoiceList(onPick: (slot: number, info: SlotInfo) => void): Promise<HTMLElement> {
  const slots = await listSlots();
  const col = h('div', { class: 'col' });
  for (const info of slots) {
    const hints: HTMLElement[] = [];
    if (info.auto) hints.push(h('span', { class: 'hint', style: { fontWeight: '400' } }, `Automático · ${describeBrief(info.auto)}`));
    if (info.manual) hints.push(h('span', { class: 'hint', style: { fontWeight: '400' } }, `Manual · ${describeBrief(info.manual)}`));
    if (!hints.length) hints.push(h('span', { class: 'hint', style: { fontWeight: '400' } }, 'Vacía · Empezar una nueva aventura'));
    col.append(h('button', {
      type: 'button',
      class: 'btn',
      style: choiceStyle,
      onclick: () => onPick(info.slot, info),
    }, h('span', { class: 'save-slot-title' }, slotTitle(info.slot)), ...hints));
  }
  return col;
}

/** Copy the chosen snapshot into the automatic save and hand it back ready to play. */
export async function resumeSnapshot(slot: number, kind: 'auto' | 'manual'): Promise<SaveData | null> {
  const data = await loadGame(slot, kind);
  if (!data) {
    toast('No se pudo leer ese guardado.');
    return null;
  }
  if (!(await adoptSnapshot(slot, data))) {
    toast('No se pudo preparar el guardado.');
    return null;
  }
  return data;
}

/** Leave the current session and come back into the chosen snapshot. */
export async function reloadSnapshot(slot: number, kind: 'auto' | 'manual'): Promise<void> {
  const data = await loadGame(slot, kind);
  if (!data) {
    toast('No se pudo leer ese guardado.');
    return;
  }
  const { stopAutosave, startAutosave } = await import('../core/flow');
  stopAutosave();
  if (!(await adoptSnapshot(slot, data))) {
    startAutosave();
    toast('No se pudo preparar el guardado.');
    return;
  }
  markResumeOnce();
  toast('Cargando partida…');
  window.setTimeout(() => location.reload(), 500);
}

export async function openInGameLoad(): Promise<void> {
  let busy = false;
  let box: { close: () => void } | null = null;
  const list = await loadChoiceList((slot, kind) => {
    if (busy) return;
    busy = true;
    void (async () => {
      try {
        const label = kind === 'manual' ? 'manual' : 'automático';
        const yes = await confirmBox(`Vas a cargar el guardado ${label} de ${slotTitle(slot)}. Lo que no hayas guardado en esta sesión se pierde.`, 'Cargar');
        if (!yes) return;
        box?.close();
        await reloadSnapshot(slot, kind);
      } finally {
        busy = false;
      }
    })();
  });
  box = panel({
    title: 'Cargar partida',
    wide: true,
    body: list,
  });
}
