/** Optional authoring tool; requires ffmpeg/ffprobe, never runs as part of the build. */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sources = {
  rain_window: 'Rain on window.mp3',
  city_night: 'distant city ambience.mp3',
  small_town: 'small town ambience.mp3',
  water_fountain: 'water fountain.mp3',
};
const scratch = mkdtempSync(join(tmpdir(), 'maki-intro-audio-'));
const ffmpeg = args => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
try {
  for (const [id, filename] of Object.entries(sources)) {
    const source = join(root, 'src/story/Sounds', filename);
    // Decode independent segments: shared-input filter EOF can truncate the overlap.
    for (const [part, start, duration] of [['head', 0, 3], ['middle', 3, 28], ['tail', 31, 3]]) {
      ffmpeg(['-ss', String(start), '-i', source, '-t', String(duration), join(scratch, part + '.wav')]);
    }
    ffmpeg(['-i', join(scratch, 'tail.wav'), '-i', join(scratch, 'head.wav'), '-filter_complex', '[0:a][1:a]acrossfade=d=2:c1=tri:c2=tri', join(scratch, 'overlap.wav')]);
    const target = join(root, 'public/audio/intro', id + '.mp3');
    ffmpeg(['-i', join(scratch, 'middle.wav'), '-i', join(scratch, 'overlap.wav'), '-filter_complex', '[0:a][1:a]concat=n=2:v=0:a=1[out]', '-map', '[out]', '-ac', '1', '-ar', '44100', '-b:a', '80k', target]);
    const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', target], { encoding: 'utf8' }));
    if (!(duration >= 32 && duration < 32.2)) throw new Error(`${id}: invalid loop duration ${duration}`);
    console.log(`${id}: ${duration.toFixed(3)} s`);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
