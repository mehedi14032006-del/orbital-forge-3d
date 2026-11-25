import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import {
  createPlanetTextures,
  createHullTexture,
  createConduitTexture,
  createParticleTexture
} from './textures.js';
import {
  createAtmosphereMaterial,
  createShieldMaterial,
  createThrusterMaterial
} from './shaders.js';

const GRID_RADIUS = 5;
const TILE_SIZE = 2.2;
const SAVE_KEY = 'orbital_forge_3d_save_v1';

export const BUILDING_CONFIG = {
  drill:  { name: 'Mining Drill',  ti: 40, pl: 0,  power: -2, hp: 120, color: 0x38bdf8 },
  relay:  { name: 'Fusion Relay',  ti: 35, pl: 0,  power: +8, hp: 100, color: 0xfbbf24 },
  laser:  { name: 'Laser Turret',  ti: 60, pl: 15, power: -3, hp: 140, color: 0x22d3ee, range: 11.5, fireRate: 0.42, dmg: 22 },
  mortar: { name: 'Plasma Mortar', ti: 90, pl: 40, power: -4, hp: 160, color: 0xc084fc, range: 15.0, fireRate: 1.55, dmg: 58, splash: 3.4 }
};

export class OrbitalForgeGame {
  constructor(container, sound, uiCallbacks) {
    this.container = container;
    this.sound = sound;
    this.ui = uiCallbacks;

    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.running = false;
    this.gameOver = false;
    this.speedMultiplier = 1;
    this.selectedTool = 'drill';
    this.shakeIntensity = 0;

    this.state = {
      titanium: 180,
      plasma: 60,
      wave: 1,
      waveTimer: 18,
      coreHp: 500,
      coreMaxHp: 500,
      tier: 1,
      rocketsLaunched: 0
    };

    this.veins = new Map();
    this.buildings = new Map();
    this.conduits = [];
    this.enemies = [];
    this.projectiles = [];
    this.lasers = [];
    this.particles = [];
    this.rocket = null;

    this._initRenderer();
    this._initScene();
    this._initLighting();
    this._initEnvironment();
    this._initArenaAndCore();
    this._initPlacementGhost();
    this._initInput();

    this._loadSave();
    this._syncHUD();

    window.addEventListener('resize', () => this._onResize());
    this._animate();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x03060c);
    this.scene.fog = new THREE.FogExp2(0x050a14, 0.011);

    this.camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.5, 280);
    this.camera.position.set(16, 19, 19);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 42;
    this.controls.maxPolarAngle = Math.PI * 0.44;
    this.controls.minPolarAngle = Math.PI * 0.16;
    this.controls.enablePan = false;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.55,
      0.45,
      0.78
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
  }

  _initScene() {
    this.textures = {
      planet: createPlanetTextures(),
      hull: createHullTexture(),
      conduitTi: createConduitTexture('#38bdf8'),
      conduitPl: createConduitTexture('#c084fc'),
      conduitPow: createConduitTexture('#fbbf24'),
      particle: createParticleTexture()
    };

    this.materials = {
      hull: new THREE.MeshStandardMaterial({
        map: this.textures.hull,
        roughness: 0.42,
        metalness: 0.68
      }),
      darkMetal: new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.5,
        metalness: 0.8
      }),
      cyanGlow: new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x38bdf8,
        emissiveIntensity: 1.9,
        roughness: 0.2
      }),
      plasmaGlow: new THREE.MeshStandardMaterial({
        color: 0xc084fc,
        emissive: 0xc084fc,
        emissiveIntensity: 2.0,
        roughness: 0.2
      }),
      amberGlow: new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xfbbf24,
        emissiveIntensity: 1.8,
        roughness: 0.2
      }),
      dangerGlow: new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: 0xf43f5e,
        emissiveIntensity: 2.2,
        roughness: 0.2
      })
    };
  }

  _initLighting() {
    const hemi = new THREE.HemisphereLight(0x7dd3fc, 0x0f172a, 0.65);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff5e4, 2.3);
    sun.position.set(24, 34, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 90;
    const d = 18;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);

    const rim = new THREE.DirectionalLight(0x38bdf8, 0.85);
    rim.position.set(-20, 12, -22);
    this.scene.add(rim);

    this.coreLight = new THREE.PointLight(0x38bdf8, 3.2, 16);
    this.coreLight.position.set(0, 3.2, 0);
    this.scene.add(this.coreLight);
  }

  _initEnvironment() {
    const starCount = 1600;
    const starPos = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const palette = [new THREE.Color(0xffffff), new THREE.Color(0xbae6fd), new THREE.Color(0xfde68a), new THREE.Color(0xe9d5ff)];

    for (let i = 0; i < starCount; i++) {
      const r = 75 + Math.random() * 140;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const c = palette[Math.floor(Math.random() * palette.length)];
      starColors[i * 3] = c.r;
      starColors[i * 3 + 1] = c.g;
      starColors[i * 3 + 2] = c.b;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({
      size: 0.75,
      vertexColors: true,
      transparent: true,
      opacity: 0.88
    });
    this.starfield = new THREE.Points(starGeo, starMat);
    this.scene.add(this.starfield);

    const giantGroup = new THREE.Group();
    giantGroup.position.set(-48, 22, -62);
    const giantMesh = new THREE.Mesh(
      new THREE.SphereGeometry(12, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.7, metalness: 0.1 })
    );
    giantGroup.add(giantMesh);

    this.atmoMat = createAtmosphereMaterial(0x38bdf8);
    const giantAtmo = new THREE.Mesh(new THREE.SphereGeometry(12.7, 32, 32), this.atmoMat);
    giantGroup.add(giantAtmo);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(15.5, 22.5, 64),
      new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.28
      })
    );
    ring.rotation.x = Math.PI * 0.42;
    ring.rotation.y = 0.25;
    giantGroup.add(ring);
    this.scene.add(giantGroup);
    this.distantPlanet = giantGroup;
  }

  _initArenaAndCore() {
    const arenaRadius = (GRID_RADIUS + 1.2) * TILE_SIZE;
    const baseGeo = new THREE.CylinderGeometry(arenaRadius, arenaRadius * 0.78, 3.2, 48);
    const baseMat = new THREE.MeshStandardMaterial({
      map: this.textures.planet.map,
      bumpMap: this.textures.planet.bumpMap,
      bumpScale: 0.28,
      roughness: 0.86,
      metalness: 0.14
    });
    this.groundMesh = new THREE.Mesh(baseGeo, baseMat);
    this.groundMesh.position.y = -1.6;
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);

    const rimRing = new THREE.Mesh(
      new THREE.TorusGeometry(arenaRadius + 0.15, 0.08, 12, 72),
      this.materials.cyanGlow
    );
    rimRing.rotation.x = Math.PI / 2;
    rimRing.position.y = -0.05;
    this.scene.add(rimRing);

    this.pickPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(arenaRadius * 2, arenaRadius * 2),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.pickPlane.rotation.x = -Math.PI / 2;
    this.scene.add(this.pickPlane);

    this.coreGroup = new THREE.Group();
    const corePedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.9, 0.7, 8),
      this.materials.hull
    );
    corePedestal.position.y = 0.35;
    corePedestal.castShadow = true;
    corePedestal.receiveShadow = true;
    this.coreGroup.add(corePedestal);

    const coreTower = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.25, 2.2, 8),
      this.materials.darkMetal
    );
    coreTower.position.y = 1.6;
    coreTower.castShadow = true;
    this.coreGroup.add(coreTower);

    this.coreRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.45, 0.11, 12, 32),
      this.materials.cyanGlow
    );
    this.coreRing.position.y = 2.6;
    this.coreGroup.add(this.coreRing);

    this.coreCrystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.68, 0),
      this.materials.cyanGlow
    );
    this.coreCrystal.position.y = 2.6;
    this.coreGroup.add(this.coreCrystal);

    this.shieldMat = createShieldMaterial();
    this.shieldMesh = new THREE.Mesh(
      new THREE.SphereGeometry(2.65, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.56),
      this.shieldMat
    );
    this.coreGroup.add(this.shieldMesh);

    this.scene.add(this.coreGroup);

    const veinCoords = [
      { gx: -3, gz: -2, type: 'titanium' },
      { gx:  3, gz: -2, type: 'titanium' },
      { gx: -2, gz:  3, type: 'titanium' },
      { gx:  3, gz:  3, type: 'titanium' },
      { gx:  0, gz: -4, type: 'plasma' },
      { gx: -4, gz:  1, type: 'plasma' },
      { gx:  4, gz:  0, type: 'plasma' }
    ];

    for (const v of veinCoords) {
      const worldPos = this._gridToWorld(v.gx, v.gz);
      const group = new THREE.Group();
      group.position.copy(worldPos);

      const mat = v.type === 'titanium' ? this.materials.cyanGlow : this.materials.plasmaGlow;
      for (let i = 0; i < 4; i++) {
        const shard = new THREE.Mesh(
          new THREE.ConeGeometry(0.24 + Math.random() * 0.16, 0.75 + Math.random() * 0.55, 5),
          mat
        );
        const angle = (i / 4) * Math.PI * 2 + Math.random() * 0.5;
        shard.position.set(Math.cos(angle) * 0.35, 0.3, Math.sin(angle) * 0.35);
        shard.rotation.z = (Math.random() - 0.5) * 0.45;
        shard.rotation.x = (Math.random() - 0.5) * 0.45;
        group.add(shard);
      }

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.68, 0.85, 24),
        new THREE.MeshBasicMaterial({
          color: v.type === 'titanium' ? 0x38bdf8 : 0xc084fc,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.45
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      group.add(ring);

      this.scene.add(group);
      this.veins.set(`${v.gx},${v.gz}`, { ...v, mesh: group });
    }
  }

  _initPlacementGhost() {
    this.ghostMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.38,
      wireframe: false
    });
    this.ghostMesh = new THREE.Mesh(
      new THREE.BoxGeometry(TILE_SIZE * 0.82, 0.25, TILE_SIZE * 0.82),
      this.ghostMat
    );
    this.ghostMesh.visible = false;
    this.scene.add(this.ghostMesh);
  }

  _initInput() {
    this.raycaster = new THREE.Raycaster();
    this.pointerDownPos = { x: 0, y: 0 };
    this.isDragging = false;

    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', (e) => {
      this.sound.unlock();
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
      this.isDragging = false;
    });

    dom.addEventListener('pointermove', (e) => {
      const dx = e.clientX - this.pointerDownPos.x;
      const dy = e.clientY - this.pointerDownPos.y;
      if (Math.hypot(dx, dy) > 9) this.isDragging = true;

      if (this.running && !this.gameOver) {
        const hit = this._pickGridTile(e.clientX, e.clientY);
        if (hit) {
          const pos = this._gridToWorld(hit.gx, hit.gz);
          this.ghostMesh.position.set(pos.x, 0.14, pos.z);
          this.ghostMesh.visible = true;
          const valid = this._canApplyTool(hit.gx, hit.gz);
          this.ghostMat.color.setHex(valid ? (this.selectedTool === 'demolish' ? 0xf43f5e : 0x38bdf8) : 0xef4444);
        } else {
          this.ghostMesh.visible = false;
        }
      }
    });

    dom.addEventListener('pointerup', (e) => {
      if (!this.running || this.gameOver || this.isDragging) return;
      const hit = this._pickGridTile(e.clientX, e.clientY);
      if (hit) {
        this._handleTileTap(hit.gx, hit.gz);
      }
    });
  }

  _pickGridTile(clientX, clientY) {
    const ndc = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObject(this.pickPlane);
    if (!hits.length) return null;

    const pt = hits[0].point;
    const gx = Math.round(pt.x / TILE_SIZE);
    const gz = Math.round(pt.z / TILE_SIZE);
    if (Math.hypot(gx, gz) > GRID_RADIUS + 0.35) return null;
    return { gx, gz };
  }

  _gridToWorld(gx, gz) {
    return new THREE.Vector3(gx * TILE_SIZE, 0, gz * TILE_SIZE);
  }

  _isCoreTile(gx, gz) {
    return Math.abs(gx) <= 1 && Math.abs(gz) <= 1 && Math.hypot(gx, gz) <= 1.1;
  }

  _canApplyTool(gx, gz) {
    const key = `${gx},${gz}`;
    if (this.selectedTool === 'demolish') {
      return this.buildings.has(key);
    }
    if (this._isCoreTile(gx, gz) || this.buildings.has(key)) return false;
    if (this.selectedTool === 'drill') {
      return this.veins.has(key);
    }
    if (this.veins.has(key)) return false;
    const cfg = BUILDING_CONFIG[this.selectedTool];
    return this.state.titanium >= cfg.ti && this.state.plasma >= cfg.pl;
  }

  _handleTileTap(gx, gz) {
    const key = `${gx},${gz}`;
    if (this.selectedTool === 'demolish') {
      const b = this.buildings.get(key);
      if (!b) return;
      const cfg = BUILDING_CONFIG[b.type];
      const refundTi = Math.floor(cfg.ti * 0.5);
      const refundPl = Math.floor(cfg.pl * 0.5);
      this.state.titanium += refundTi;
      this.state.plasma += refundPl;
      this.scene.remove(b.mesh);
      this.buildings.delete(key);
      this._rebuildConduits();
      this.sound.playScrap();
      this._spawnExplosion(b.pos, 0x94a3b8, 12);
      this._spawnPopup(b.pos, `+${refundTi} TI`, '#94a3b8');
      this._saveState();
      this._syncHUD();
      return;
    }

    if (!this._canApplyTool(gx, gz)) {
      this.sound.playError();
      const pos = this._gridToWorld(gx, gz);
      if (this.selectedTool === 'drill' && !this.veins.has(key)) {
        this._spawnPopup(pos, 'NEEDS ORE VEIN', '#f43f5e');
      } else {
        this._spawnPopup(pos, 'CANNOT BUILD', '#f43f5e');
      }
      return;
    }

    const cfg = BUILDING_CONFIG[this.selectedTool];
    this.state.titanium -= cfg.ti;
    this.state.plasma -= cfg.pl;
    this._placeBuilding(gx, gz, this.selectedTool);
    this.sound.playBuild();
    this._saveState();
    this._syncHUD();
  }

  _placeBuilding(gx, gz, type) {
    const key = `${gx},${gz}`;
    const pos = this._gridToWorld(gx, gz);
    const cfg = BUILDING_CONFIG[type];
    const group = new THREE.Group();
    group.position.copy(pos);

    let turretHead = null;
    let spinner = null;

    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.82, 0.96, 0.28, 6),
      this.materials.hull
    );
    pad.position.y = 0.14;
    pad.castShadow = true;
    pad.receiveShadow = true;
    group.add(pad);

    if (type === 'drill') {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.95), this.materials.darkMetal);
      frame.position.y = 0.72;
      frame.castShadow = true;
      group.add(frame);

      spinner = new THREE.Mesh(
        new THREE.ConeGeometry(0.36, 1.1, 6),
        this.veins.get(key)?.type === 'plasma' ? this.materials.plasmaGlow : this.materials.cyanGlow
      );
      spinner.position.y = 0.7;
      spinner.rotation.x = Math.PI;
      group.add(spinner);
    } else if (type === 'relay') {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 1.35, 8), this.materials.darkMetal);
      mast.position.y = 0.85;
      mast.castShadow = true;
      group.add(mast);

      spinner = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.08, 8, 20), this.materials.amberGlow);
      spinner.position.y = 1.65;
      group.add(spinner);
    } else if (type === 'laser') {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.62, 0.65, 8), this.materials.darkMetal);
      base.position.y = 0.55;
      group.add(base);

      turretHead = new THREE.Group();
      turretHead.position.y = 0.98;
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.44, 0.86), this.materials.hull);
      body.castShadow = true;
      turretHead.add(body);

      const barrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.95, 8), this.materials.cyanGlow);
      barrelL.rotation.x = Math.PI / 2;
      barrelL.position.set(-0.2, 0.02, 0.62);
      turretHead.add(barrelL);

      const barrelR = barrelL.clone();
      barrelR.position.x = 0.2;
      turretHead.add(barrelR);
      group.add(turretHead);
    } else if (type === 'mortar') {
      const chassis = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.74, 0.65, 8), this.materials.darkMetal);
      chassis.position.y = 0.55;
      group.add(chassis);

      turretHead = new THREE.Group();
      turretHead.position.y = 0.95;
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.55, 0.85), this.materials.hull);
      turretHead.add(housing);

      const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 1.15, 10), this.materials.plasmaGlow);
      cannon.rotation.x = Math.PI * 0.32;
      cannon.position.set(0, 0.38, 0.34);
      turretHead.add(cannon);
      group.add(turretHead);
    }

    this.scene.add(group);
    this.buildings.set(key, {
      gx,
      gz,
      key,
      type,
      pos,
      mesh: group,
      turretHead,
      spinner,
      hp: cfg.hp,
      maxHp: cfg.hp,
      cooldown: 0,
      mineTimer: 0,
      veinType: this.veins.get(key)?.type || null
    });

    this._rebuildConduits();
    this._spawnExplosion(pos, cfg.color, 10);
  }

  _rebuildConduits() {
    for (const c of this.conduits) this.scene.remove(c.mesh);
    this.conduits = [];

    const corePos = new THREE.Vector3(0, 0.55, 0);
    for (const b of this.buildings.values()) {
      let target = corePos;
      let tex = this.textures.conduitPow;
      if (b.type === 'drill') {
        tex = b.veinType === 'plasma' ? this.textures.conduitPl : this.textures.conduitTi;
      } else if (b.type === 'laser' || b.type === 'mortar') {
        let bestDist = b.pos.distanceTo(corePos);
        for (const other of this.buildings.values()) {
          if (other.type === 'relay') {
            const d = b.pos.distanceTo(other.pos);
            if (d < bestDist) {
              bestDist = d;
              target = other.pos.clone().setY(0.55);
            }
          }
        }
      }

      const start = b.pos.clone().setY(0.45);
      const end = target.clone();
      const dist = start.distanceTo(end);
      const mid = start.clone().add(end).multiplyScalar(0.5);

      const geo = new THREE.PlaneGeometry(dist, 0.22);
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const beam = new THREE.Mesh(geo, mat);
      beam.position.copy(mid);
      beam.position.y = 0.22;
      beam.rotation.x = -Math.PI / 2;
      beam.rotation.z = -Math.atan2(end.z - start.z, end.x - start.x);
      this.scene.add(beam);
      this.conduits.push({ mesh: beam, tex });
    }
  }

  _getPowerStats() {
    let generated = 10 + (this.state.tier - 1) * 4;
    let consumed = 0;
    for (const b of this.buildings.values()) {
      const p = BUILDING_CONFIG[b.type].power;
      if (p > 0) generated += p;
      else consumed += Math.abs(p);
    }
    const efficiency = consumed <= generated ? 1.0 : Math.max(0.35, generated / consumed);
    return { generated, consumed, efficiency };
  }

  getLaunchCost() {
    return {
      ti: 250 * this.state.tier,
      pl: 120 * this.state.tier
    };
  }

  launchOrbitalRocket() {
    const cost = this.getLaunchCost();
    if (this.state.titanium < cost.ti || this.state.plasma < cost.pl || this.rocket) return;

    this.state.titanium -= cost.ti;
    this.state.plasma -= cost.pl;
    this.state.tier += 1;
    this.state.rocketsLaunched += 1;
    this.state.coreMaxHp += 150;
    this.state.coreHp = this.state.coreMaxHp;

    this.sound.playRocketLaunch();
    this.shakeIntensity = 0.55;

    const rGroup = new THREE.Group();
    rGroup.position.set(0, 2.2, 0);

    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.48, 2.8, 12), this.materials.hull);
    fuselage.position.y = 1.4;
    rGroup.add(fuselage);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.95, 12), this.materials.cyanGlow);
    nose.position.y = 3.25;
    rGroup.add(nose);

    const thrusterMat = createThrusterMaterial();
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.6, 12, 1, true), thrusterMat);
    plume.rotation.x = Math.PI;
    plume.position.y = -1.2;
    rGroup.add(plume);

    const rocketLight = new THREE.PointLight(0x38bdf8, 6, 22);
    rocketLight.position.y = -0.6;
    rGroup.add(rocketLight);

    this.scene.add(rGroup);
    this.rocket = { mesh: rGroup, velY: 1.5, thrusterMat, age: 0 };
    this._spawnPopup(new THREE.Vector3(0, 4.2, 0), `ORBITAL TIER ${this.state.tier}!`, '#38bdf8');
    this._saveState();
    this._syncHUD();
  }

  _spawnWave() {
    this.sound.playWaveAlarm();
    const count = 4 + this.state.wave * 2;
    for (let i = 0; i < count; i++) {
      const isMeteor = Math.random() < 0.45;
      const angle = Math.random() * Math.PI * 2;
      const dist = 21 + Math.random() * 8;
      const startPos = new THREE.Vector3(
        Math.cos(angle) * dist,
        isMeteor ? 11 + Math.random() * 7 : 2.6 + Math.random() * 2.2,
        Math.sin(angle) * dist
      );

      const group = new THREE.Group();
      group.position.copy(startPos);

      if (isMeteor) {
        const rock = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.62, 0),
          new THREE.MeshStandardMaterial({
            color: 0x7c2d12,
            emissive: 0xf97316,
            emissiveIntensity: 1.35,
            roughness: 0.75
          })
        );
        group.add(rock);
      } else {
        const hull = new THREE.Mesh(new THREE.OctahedronGeometry(0.52, 0), this.materials.darkMetal);
        hull.scale.set(1.3, 0.55, 1.3);
        group.add(hull);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), this.materials.dangerGlow);
        group.add(eye);
      }

      this.scene.add(group);
      const hp = (isMeteor ? 52 : 38) + this.state.wave * 14;
      this.enemies.push({
        type: isMeteor ? 'meteor' : 'drone',
        mesh: group,
        pos: startPos,
        hp,
        maxHp: hp,
        speed: isMeteor ? 3.2 + this.state.wave * 0.14 : 4.1 + this.state.wave * 0.16,
        rewardTi: isMeteor ? 14 : 18,
        rewardPl: isMeteor ? 5 : 8
      });
    }
  }

  _spawnExplosion(pos, colorHex, count = 16) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.textures.particle,
        color: colorHex,
        blending: THREE.AdditiveBlending,
        transparent: true
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.copy(pos);
      const s = 0.35 + Math.random() * 0.55;
      sprite.scale.set(s, s, 1);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 7,
        1.5 + Math.random() * 5,
        (Math.random() - 0.5) * 7
      );
      this.scene.add(sprite);
      this.particles.push({ sprite, vel, life: 0.45 + Math.random() * 0.35, maxLife: 0.8 });
    }
  }

  _spawnLaserBeam(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.95 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.lasers.push({ line, life: 0.11 });
  }

  _spawnPopup(worldPos, text, color = '#38bdf8') {
    const proj = worldPos.clone().project(this.camera);
    if (proj.z > 1) return;
    const x = (proj.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-proj.y * 0.5 + 0.5) * window.innerHeight;
    this.ui.spawnPopup(x, y, text, color);
  }

  _updateSimulation(dt) {
    const power = this._getPowerStats();

    this.state.waveTimer -= dt;
    if (this.state.waveTimer <= 0) {
      this._spawnWave();
      this.state.wave += 1;
      this.state.waveTimer = Math.max(12, 22 - this.state.wave * 0.4);
      this._saveState();
    }

    for (const b of this.buildings.values()) {
      if (b.spinner) {
        b.spinner.rotation.y += dt * 3.8 * power.efficiency;
        if (b.type === 'relay') b.spinner.rotation.x += dt * 1.4;
      }

      if (b.type === 'drill') {
        b.mineTimer += dt * power.efficiency;
        if (b.mineTimer >= 2.2) {
          b.mineTimer = 0;
          const yieldAmt = (b.veinType === 'plasma' ? 7 : 12) + (this.state.tier - 1) * 3;
          if (b.veinType === 'plasma') {
            this.state.plasma += yieldAmt;
            this._spawnPopup(b.pos.clone().setY(1.6), `+${yieldAmt} PL`, '#c084fc');
          } else {
            this.state.titanium += yieldAmt;
            this._spawnPopup(b.pos.clone().setY(1.6), `+${yieldAmt} TI`, '#38bdf8');
          }
        }
      }

      if (b.type === 'laser' || b.type === 'mortar') {
        const cfg = BUILDING_CONFIG[b.type];
        b.cooldown = Math.max(0, b.cooldown - dt * power.efficiency);

        let target = null;
        let bestDist = cfg.range;
        for (const e of this.enemies) {
          const d = b.pos.distanceTo(e.pos);
          if (d < bestDist) {
            bestDist = d;
            target = e;
          }
        }

        if (target && b.turretHead) {
          b.turretHead.lookAt(target.pos.x, b.turretHead.position.y + b.pos.y, target.pos.z);
          if (b.cooldown <= 0) {
            b.cooldown = cfg.fireRate;
            const muzzle = b.pos.clone().add(new THREE.Vector3(0, 1.15, 0));
            if (b.type === 'laser') {
              this._spawnLaserBeam(muzzle, target.pos.clone());
              this.sound.playLaser();
              this._damageEnemy(target, cfg.dmg);
            } else {
              this.sound.playMortar();
              const orb = new THREE.Mesh(
                new THREE.SphereGeometry(0.24, 10, 10),
                this.materials.plasmaGlow
              );
              orb.position.copy(muzzle);
              this.scene.add(orb);
              this.projectiles.push({
                mesh: orb,
                pos: muzzle,
                targetPos: target.pos.clone(),
                speed: 14,
                dmg: cfg.dmg,
                splash: cfg.splash
              });
            }
          }
        }
      }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const dir = p.targetPos.clone().sub(p.pos);
      const dist = dir.length();
      if (dist < 0.65) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        this._spawnExplosion(p.pos, 0xc084fc, 18);
        this.sound.playExplosion();
        this.shakeIntensity = Math.max(this.shakeIntensity, 0.18);
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          if (this.enemies[j].pos.distanceTo(p.pos) <= p.splash) {
            this._damageEnemy(this.enemies[j], p.dmg);
          }
        }
      } else {
        dir.normalize();
        p.pos.addScaledVector(dir, p.speed * dt);
        p.mesh.position.copy(p.pos);
      }
    }

    const coreTarget = new THREE.Vector3(0, 1.4, 0);
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const dir = coreTarget.clone().sub(e.pos);
      const dist = dir.length();
      if (dist < 2.2) {
        this.state.coreHp = Math.max(0, this.state.coreHp - 35);
        this.shieldMat.uniforms.uHit.value = 1.0;
        this.shakeIntensity = 0.42;
        this.sound.playExplosion();
        this._spawnExplosion(e.pos, 0xf43f5e, 20);
        this.scene.remove(e.mesh);
        this.enemies.splice(i, 1);

        if (this.state.coreHp <= 0) {
          this.gameOver = true;
          this.running = false;
          this.ui.onGameOver(this.state.wave - 1, this.state.rocketsLaunched);
        }
      } else {
        dir.normalize();
        e.pos.addScaledVector(dir, e.speed * dt);
        e.mesh.position.copy(e.pos);
        e.mesh.rotation.x += dt * 2.2;
        e.mesh.rotation.y += dt * 1.8;
      }
    }

    if (this.rocket) {
      this.rocket.age += dt;
      this.rocket.velY += dt * 14.5;
      this.rocket.mesh.position.y += this.rocket.velY * dt;
      this.rocket.thrusterMat.uniforms.uTime.value = this.elapsed;
      if (Math.random() < 0.7) {
        this._spawnExplosion(this.rocket.mesh.position.clone().add(new THREE.Vector3(0, -1.6, 0)), 0x38bdf8, 2);
      }
      if (this.rocket.mesh.position.y > 55) {
        this.scene.remove(this.rocket.mesh);
        this.rocket = null;
      }
    }
  }

  _damageEnemy(enemy, amount) {
    enemy.hp -= amount;
    if (enemy.hp <= 0) {
      const idx = this.enemies.indexOf(enemy);
      if (idx !== -1) {
        this.enemies.splice(idx, 1);
        this.scene.remove(enemy.mesh);
        this.state.titanium += enemy.rewardTi;
        this.state.plasma += enemy.rewardPl;
        this.sound.playExplosion();
        this._spawnExplosion(enemy.pos, 0xfbbf24, 16);
        this._spawnPopup(enemy.pos, `+${enemy.rewardTi} TI`, '#fbbf24');
      }
    }
  }

  _animate() {
    requestAnimationFrame(() => this._animate());

    const rawDt = Math.min(this.clock.getDelta(), 0.05);
    const dt = rawDt * this.speedMultiplier;
    this.elapsed += rawDt;

    this.starfield.rotation.y += rawDt * 0.008;
    this.distantPlanet.rotation.y += rawDt * 0.03;
    this.coreRing.rotation.x = Math.sin(this.elapsed * 0.9) * 0.45;
    this.coreRing.rotation.y += rawDt * 1.1;
    this.coreCrystal.rotation.y -= rawDt * 1.6;
    this.coreCrystal.position.y = 2.6 + Math.sin(this.elapsed * 2.4) * 0.14;

    this.atmoMat.uniforms.uTime.value = this.elapsed;
    this.shieldMat.uniforms.uTime.value = this.elapsed;
    this.shieldMat.uniforms.uHit.value = Math.max(0, this.shieldMat.uniforms.uHit.value - rawDt * 2.8);

    this.textures.conduitTi.offset.x -= rawDt * 1.6;
    this.textures.conduitPl.offset.x -= rawDt * 1.6;
    this.textures.conduitPow.offset.x -= rawDt * 2.1;

    if (this.running && !this.gameOver) {
      this._updateSimulation(dt);
      this._syncHUD();
    }

    for (let i = this.lasers.length - 1; i >= 0; i--) {
      this.lasers[i].life -= rawDt;
      if (this.lasers[i].life <= 0) {
        this.scene.remove(this.lasers[i].line);
        this.lasers.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= rawDt;
      if (p.life <= 0) {
        this.scene.remove(p.sprite);
        this.particles.splice(i, 1);
      } else {
        p.vel.y -= 9.5 * rawDt;
        p.sprite.position.addScaledVector(p.vel, rawDt);
        p.sprite.material.opacity = p.life / p.maxLife;
      }
    }

    this.controls.update();
    if (this.shakeIntensity > 0.01) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity *= Math.pow(0.05, rawDt);
    }

    this.composer.render();
  }

  _syncHUD() {
    const power = this._getPowerStats();
    const launchCost = this.getLaunchCost();
    this.ui.updateHUD({
      titanium: Math.floor(this.state.titanium),
      plasma: Math.floor(this.state.plasma),
      powerUsed: power.consumed,
      powerTotal: power.generated,
      wave: this.state.wave,
      waveTimer: Math.ceil(this.state.waveTimer),
      coreHp: this.state.coreHp,
      coreMaxHp: this.state.coreMaxHp,
      tier: this.state.tier,
      launchCost,
      canLaunch: this.state.titanium >= launchCost.ti && this.state.plasma >= launchCost.pl && !this.rocket
    });
  }

  _saveState() {
    try {
      const savedBuildings = [];
      for (const b of this.buildings.values()) {
        savedBuildings.push({ gx: b.gx, gz: b.gz, type: b.type });
      }
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        state: this.state,
        buildings: savedBuildings
      }));
    } catch {
      // Ignore storage quota errors
    }
  }

  _loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data?.state) Object.assign(this.state, data.state);
      if (Array.isArray(data?.buildings)) {
        for (const b of data.buildings) {
          this._placeBuilding(b.gx, b.gz, b.type);
        }
      }
    } catch {
      // Ignore corrupted save
    }
  }

  start() {
    this.running = true;
    this.gameOver = false;
  }

  setTool(tool) {
    this.selectedTool = tool;
  }

  toggleSpeed() {
    this.speedMultiplier = this.speedMultiplier === 1 ? 2 : 1;
    return this.speedMultiplier;
  }

  resetColony() {
    localStorage.removeItem(SAVE_KEY);
    for (const b of this.buildings.values()) this.scene.remove(b.mesh);
    this.buildings.clear();
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.projectiles = [];
    this._rebuildConduits();

    this.state = {
      titanium: 180,
      plasma: 60,
      wave: 1,
      waveTimer: 18,
      coreHp: 500,
      coreMaxHp: 500,
      tier: 1,
      rocketsLaunched: 0
    };
    this.gameOver = false;
    this.running = true;
    this._syncHUD();
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }
}
