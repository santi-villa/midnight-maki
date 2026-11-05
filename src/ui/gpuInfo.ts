/**
 * `?gpuinfo` in the address: a small badge in the corner that says what this device really runs, to check the Phaser 4
 * paths on a real phone (the test browser has no graphics card, so the GPU ground could never be seen there):
 * the graphics card's name, whether the village ground is on the GPU (TilemapGPULayer), whether the extras run (filters,
 * GPU weather, lights) or the device fell back to the light path, the canvas size and pixels per CSS pixel
 * (core/pixelRatio.ts) and the frame rate. It never shows without the flag.
 */
export interface GpuInfo {
  renderer: string;
  webgl: boolean;
  software: boolean;
  groundGpu: boolean | null;
  extras: boolean;
  battery: boolean;
  canvas: [number, number];
  px: number;
  fps: number;
}

const yesNo = (v: boolean) => (v ? 'sí' : 'no');

/** The badge's lines (pure, for the tests). */
export function gpuInfoLines(i: GpuInfo): string[] {
  return [
    `Placa: ${i.renderer || 'desconocida'}${i.software ? ' (por software)' : ''}${i.webgl ? '' : ' · sin WebGL'}`,
    `Suelo en GPU: ${i.groundGpu === null ? 'todavía no (afuera del pueblo)' : yesNo(i.groundGpu)} · efectos: ${yesNo(i.extras)}${i.battery ? ' · modo batería' : ''}`,
    `Canvas ${i.canvas[0]}×${i.canvas[1]} · ×${+i.px.toFixed(3)} por píxel CSS · ${Math.round(i.fps)} fps`,
  ];
}

export function installGpuInfo(game: Phaser.Game) {
  if (typeof location === 'undefined' || !new URLSearchParams(location.search).has('gpuinfo')) return;
  const el = document.createElement('div');
  el.className = 'gpu-info';
  Object.assign(el.style, {
    position: 'fixed', left: '4px', bottom: '4px', zIndex: '9999', pointerEvents: 'none', whiteSpace: 'pre-wrap', maxWidth: 'calc(100vw - 8px)', boxSizing: 'border-box',
    font: '11px/1.35 monospace', color: '#fbf6ea', background: 'rgba(31,36,64,.82)', padding: '4px 6px', borderRadius: '4px',
  } as Partial<CSSStyleDeclaration>);
  document.body.append(el);
  let renderer = '';
  const tick = async () => {
    const [{ softwareGl, richFx }, { gamePx }, { lowPower }, w] = await Promise.all([
      import('../scenes/gpuProbe'), import('../core/pixelRatio'), import('../core/perf'), import('../scenes/WorldScene'),
    ]);
    const r = game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
    const gl = (r as { gl?: WebGLRenderingContext }).gl;
    if (!renderer && gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    }
    const world = w.world as typeof w.world | undefined;
    el.textContent = gpuInfoLines({
      renderer, webgl: !!gl, software: softwareGl(r), extras: richFx(r), battery: lowPower(),
      groundGpu: world?.scene?.isActive() && world.liveId === 'village' ? world.groundOnGpu : null,
      canvas: [game.canvas.width, game.canvas.height], px: gamePx(), fps: game.loop.actualFps,
    }).join('\n');
  };
  void tick();
  setInterval(() => void tick(), 1000);
}
