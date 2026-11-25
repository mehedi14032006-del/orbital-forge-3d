import * as THREE from 'three';

function makeCanvas(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return { canvas, ctx: canvas.getContext('2d') };
}

/**
 * Generates paired procedural PBR textures (diffuse + bump)
 * for the cratered basalt planetoid surface.
 */
export function createPlanetTextures() {
  const size = 512;
  const diff = makeCanvas(size);
  const bump = makeCanvas(size);

  diff.ctx.fillStyle = '#1b2434';
  diff.ctx.fillRect(0, 0, size, size);
  bump.ctx.fillStyle = '#808080';
  bump.ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 2.2 + 0.5;
    const shade = 22 + Math.floor(Math.random() * 34);
    diff.ctx.fillStyle = `rgb(${shade}, ${shade + 7}, ${shade + 18})`;
    diff.ctx.fillRect(x, y, r, r);

    const bVal = 110 + Math.floor(Math.random() * 40);
    bump.ctx.fillStyle = `rgb(${bVal},${bVal},${bVal})`;
    bump.ctx.fillRect(x, y, r, r);
  }

  for (let i = 0; i < 42; i++) {
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    const radius = 10 + Math.random() * 38;

    const dg = diff.ctx.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius);
    dg.addColorStop(0, 'rgba(9, 13, 22, 0.85)');
    dg.addColorStop(0.75, 'rgba(20, 28, 44, 0.55)');
    dg.addColorStop(0.92, 'rgba(72, 96, 132, 0.45)');
    dg.addColorStop(1, 'rgba(27, 36, 52, 0)');
    diff.ctx.fillStyle = dg;
    diff.ctx.beginPath();
    diff.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    diff.ctx.fill();

    const bg = bump.ctx.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius);
    bg.addColorStop(0, 'rgba(30, 30, 30, 0.9)');
    bg.addColorStop(0.75, 'rgba(75, 75, 75, 0.6)');
    bg.addColorStop(0.9, 'rgba(235, 235, 235, 0.75)');
    bg.addColorStop(1, 'rgba(128, 128, 128, 0)');
    bump.ctx.fillStyle = bg;
    bump.ctx.beginPath();
    bump.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    bump.ctx.fill();
  }

  diff.ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
  diff.ctx.lineWidth = 1;
  const step = size / 12;
  for (let i = 0; i <= 12; i++) {
    const p = i * step;
    diff.ctx.beginPath();
    diff.ctx.moveTo(p, 0);
    diff.ctx.lineTo(p, size);
    diff.ctx.stroke();
    diff.ctx.beginPath();
    diff.ctx.moveTo(0, p);
    diff.ctx.lineTo(size, p);
    diff.ctx.stroke();
  }

  const map = new THREE.CanvasTexture(diff.canvas);
  const bumpMap = new THREE.CanvasTexture(bump.canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, bumpMap };
}

/**
 * Generates metallic sci-fi armor plating texture for buildings & core.
 */
export function createHullTexture() {
  const { canvas, ctx } = makeCanvas(256);
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3;
  for (let y = 0; y < 256; y += 64) {
    for (let x = 0; x < 256; x += 64) {
      ctx.fillStyle = (x + y) % 128 === 0 ? '#3b4a62' : '#2d3b4e';
      ctx.fillRect(x + 3, y + 3, 58, 58);
      ctx.strokeRect(x + 2, y + 2, 60, 60);

      ctx.fillStyle = '#64748b';
      ctx.fillRect(x + 8, y + 8, 4, 4);
      ctx.fillRect(x + 52, y + 8, 4, 4);
      ctx.fillRect(x + 8, y + 52, 4, 4);
      ctx.fillRect(x + 52, y + 52, 4, 4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates an animated energy-stream texture for conveyor/power conduits.
 */
export function createConduitTexture(colorHex = '#38bdf8') {
  const { canvas, ctx } = makeCanvas(128);
  ctx.clearRect(0, 0, 128, 128);

  const grad = ctx.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.35, colorHex);
  grad.addColorStop(0.5, '#ffffff');
  grad.addColorStop(0.65, colorHex);
  grad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 36, 128, 56);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  return tex;
}

/**
 * Generates a soft glowing radial sprite for particles & explosions.
 */
export function createParticleTexture() {
  const { canvas, ctx } = makeCanvas(64);
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}
