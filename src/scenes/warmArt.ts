/** Paints outdoor sheets before the player walks out, one at a time. A folk sheet or a building is a full canvas and cannot be sliced. */
import type Phaser from 'phaser';
import { CHARACTERS } from '../data/characters';
import { NEIGHBORS } from '../data/neighbors';
import { PROPS } from '../data/props';
import { ZONES } from '../data/zones';
import { charTexture, hasCharTexture, hasLookTexture, lookTexture, propTexture } from './textures';

type WarmJob = (scene: Phaser.Scene) => boolean;

let warmJobs: WarmJob[] | null = null;

function propJob(id: string, closed = false): WarmJob {
  const key = 'pr_' + id + (closed ? '_closed' : '');
  return (scene) => {
    if (!PROPS[id] || scene.textures.exists(key)) return false;
    propTexture(scene, id, closed);
    return true;
  };
}

function buildWarmJobs(): WarmJob[] {
  const jobs: WarmJob[] = [];
  const people = new Set<string>(['player', ...CHARACTERS.map((c) => c.id)]);
  for (const id of people) {
    jobs.push((scene) => {
      if (hasCharTexture(scene, id)) return false;
      charTexture(scene, id);
      return true;
    });
  }
  for (const n of NEIGHBORS) {
    jobs.push((scene) => {
      if (hasLookTexture(scene, n.look)) return false;
      lookTexture(scene, n.look);
      return true;
    });
  }
  const props = new Set<string>();
  for (const p of ZONES.plaza?.props ?? []) props.add(p.id);
  for (const id of props) {
    jobs.push(propJob(id));
    const kind = PROPS[id]?.kind;
    if (kind === 'building' || kind === 'townhouse' || kind === 'sidehouse') jobs.push(propJob(id, true));
  }
  return jobs;
}

/** Paints the next missing outdoor sheet. Already-cached jobs are skipped, up to a small cap, so a call stays one real canvas. */
export function warmNextOutdoor(scene: Phaser.Scene): boolean {
  if (!warmJobs) warmJobs = buildWarmJobs();
  let skipped = 0;
  while (warmJobs.length && skipped < 48) {
    const job = warmJobs.shift()!;
    if (job(scene)) return true;
    skipped++;
  }
  return false;
}
