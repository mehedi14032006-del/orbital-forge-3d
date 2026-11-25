import { SoundEngine } from './audio.js';
import { OrbitalForgeGame } from './game.js';

const sound = new SoundEngine();

const els = {
  container: document.getElementById('canvas-container'),
  fxLayer: document.getElementById('fx-layer'),
  titanium: document.getElementById('res-titanium'),
  plasma: document.getElementById('res-plasma'),
  energy: document.getElementById('res-energy'),
  waveNum: document.getElementById('wave-num'),
  waveTimer: document.getElementById('wave-timer'),
  coreFill: document.getElementById('core-hp-fill'),
  coreText: document.getElementById('core-hp-text'),
  tierNum: document.getElementById('tier-num'),
  btnLaunch: document.getElementById('btn-launch'),
  launchCost: document.getElementById('launch-cost'),
  btnAudio: document.getElementById('btn-audio'),
  btnSpeed: document.getElementById('btn-speed'),
  btnReset: document.getElementById('btn-reset'),
  overlayStart: document.getElementById('overlay-start'),
  overlayOver: document.getElementById('overlay-gameover'),
  overStats: document.getElementById('gameover-stats'),
  btnPlay: document.getElementById('btn-play'),
  btnRetry: document.getElementById('btn-retry')
};

const game = new OrbitalForgeGame(els.container, sound, {
  updateHUD(data) {
    els.titanium.textContent = data.titanium;
    els.plasma.textContent = data.plasma;
    els.energy.textContent = `${data.powerUsed}/${data.powerTotal}`;
    els.waveNum.textContent = data.wave;

    const secs = String(Math.max(0, data.waveTimer)).padStart(2, '0');
    els.waveTimer.textContent = `00:${secs}`;

    const pct = Math.max(0, Math.round((data.coreHp / data.coreMaxHp) * 100));
    els.coreFill.style.width = `${pct}%`;
    els.coreFill.style.background =
      pct > 50 ? 'linear-gradient(90deg, #059669, #34d399)'
      : pct > 25 ? 'linear-gradient(90deg, #d97706, #fbbf24)'
      : 'linear-gradient(90deg, #be123c, #f43f5e)';
    els.coreText.textContent = `CORE ${pct}%`;

    els.tierNum.textContent = data.tier;
    els.launchCost.textContent = `(${data.launchCost.ti} TI · ${data.launchCost.pl} PL)`;
    els.btnLaunch.disabled = !data.canLaunch;
  },

  spawnPopup(x, y, text, color) {
    const el = document.createElement('div');
    el.className = 'float-pop';
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.color = color;
    els.fxLayer.appendChild(el);
    setTimeout(() => el.remove(), 960);
  },

  onGameOver(waves, rockets) {
    els.overStats.textContent = `Survived ${waves} wave${waves === 1 ? '' : 's'} · Launched ${rockets} orbital rocket${rockets === 1 ? '' : 's'}.`;
    els.overlayOver.classList.add('visible');
  }
});

document.querySelectorAll('.build-card').forEach((btn) => {
  btn.addEventListener('click', () => {
    sound.unlock();
    sound.playClick();
    document.querySelectorAll('.build-card').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    game.setTool(btn.dataset.type);
  });
});

els.btnPlay.addEventListener('click', () => {
  sound.unlock();
  sound.playBuild();
  els.overlayStart.classList.remove('visible');
  game.start();
});

els.btnRetry.addEventListener('click', () => {
  sound.unlock();
  sound.playBuild();
  els.overlayOver.classList.remove('visible');
  game.resetColony();
});

els.btnLaunch.addEventListener('click', () => {
  sound.unlock();
  game.launchOrbitalRocket();
});

els.btnAudio.addEventListener('click', () => {
  sound.unlock();
  const muted = sound.toggleMute();
  els.btnAudio.textContent = muted ? '🔇' : '🔊';
});

els.btnSpeed.addEventListener('click', () => {
  sound.unlock();
  sound.playClick();
  const mult = game.toggleSpeed();
  els.btnSpeed.textContent = `${mult}x`;
});

els.btnReset.addEventListener('click', () => {
  sound.unlock();
  sound.playScrap();
  game.resetColony();
});
