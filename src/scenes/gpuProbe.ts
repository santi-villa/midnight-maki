/**
 * Phaser 4 draws the village ground with a special shader (TilemapGPULayer). Some graphics drivers (software WebGL, like
 * SwiftShader, which a browser falls back to without a usable GPU) run it without any error but put nothing on screen,
 * which would leave the ground black. So while the title is up the game draws one tile with it, for a single frame, through
 * a tiny 8×8 camera in the corner of the screen, and reads that pixel back from the screen itself. Only if the tile is
 * really there does the village use the GPU ground; until the answer is in, and if it fails, the ground is drawn the
 * classic way, which always works.
 */
import Phaser from 'phaser';

let tilemapOk: boolean | null = null;

/** True once the GPU tile layer was seen on screen on this device. */
export function gpuTilemapWorks(): boolean { return tilemapOk === true; }

/**
 * Shows `tile` of the `tiles` texture for one frame in an 8×8 corner camera and reads the screen there.
 * `gpu: false` runs the same check with the classic layer (to prove the check itself can see a tile).
 */
export function probeGpuTilemap(scene: Phaser.Scene, tile: number, gpu = true, timeoutMs = 3000): Promise<boolean> {
  if (gpu && tilemapOk !== null) return Promise.resolve(tilemapOk);
  const renderer = scene.renderer;
  if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) || !scene.textures.exists('tiles')) {
    if (gpu) tilemapOk = false;
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    let done = false, cleanup = () => {};
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      if (gpu) tilemapOk = ok;
      cleanup();
      resolve(ok);
    };
    try {
      const map = scene.make.tilemap({ data: [[tile]], tileWidth: 16, tileHeight: 16 });
      const ts = map.addTilesetImage('tiles', 'tiles', 16, 16, 0, 0)!;
      // far away from anything the scene shows, and drawn only by the probe camera
      const layer = map.createLayer(0, ts, -10000, -10000, gpu)!;
      for (const cam of scene.cameras.cameras) cam.ignore(layer);
      const cam = scene.cameras.add(0, 0, 8, 8).setScroll(-10000, -10000).setBackgroundColor(0x000000);
      cam.ignore(scene.children.list.filter((o) => o !== layer));
      cleanup = () => { scene.cameras.remove(cam); layer.destroy(); map.destroy(); };
      // after a frame has been drawn with the probe camera, read the screen at its middle
      scene.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
        renderer.snapshotPixel(4, 4, (c) => finish(!!c && (c as Phaser.Display.Color).alpha > 0 && ((c as Phaser.Display.Color).red + (c as Phaser.Display.Color).green + (c as Phaser.Display.Color).blue) > 30));
      });
      setTimeout(() => finish(false), timeoutMs);
    } catch {
      finish(false);
    }
  });
}

let software: boolean | null = null;
/**
 * WebGL emulated on the CPU (SwiftShader, llvmpipe, Microsoft Basic Render: a browser without a usable graphics card).
 * There every full-screen filter costs a lot, so the Phaser 4 extras (camera filters, rippling water, GPU weather) stay
 * off and the game keeps its lighter effects. `?fx` in the address turns them on anyway (to test them).
 */
export function softwareGl(renderer: Phaser.Renderer.Canvas.CanvasRenderer | Phaser.Renderer.WebGL.WebGLRenderer | null | undefined): boolean {
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('fx')) return false;
  if (software !== null) return software;
  if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return (software = true);
  try {
    const gl = renderer.gl, info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    software = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
  } catch { software = false; }
  return software;
}

/** The Phaser 4 extras run here: WebGL on a real graphics card (or forced with `?fx`). */
export function richFx(renderer: Phaser.Renderer.Canvas.CanvasRenderer | Phaser.Renderer.WebGL.WebGLRenderer | null | undefined): boolean {
  return renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer && !softwareGl(renderer);
}
