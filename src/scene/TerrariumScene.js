import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Showcase, ARENA_RADIUS } from '../physics/showcase.js';

const ISLAND_RADIUS = ARENA_RADIUS + 3;

const LIGHTING = {
  dawn: { sky: 0xf4c6a5, sun: 0xffc48a, intensity: 1.2, ambient: 0.5 },
  day: { sky: 0x9fd4f0, sun: 0xffffff, intensity: 2.2, ambient: 0.8 },
  dusk: { sky: 0xd98a7a, sun: 0xff9566, intensity: 1.0, ambient: 0.45 },
  night: { sky: 0x101830, sun: 0x8fa8ff, intensity: 0.35, ambient: 0.25 },
};

export class TerrariumScene {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    this.camera.position.set(20, 13, 20);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.target.set(0, 0, 0);

    this.ambient = new THREE.HemisphereLight(0xffffff, 0x4a3b2a, 0.8);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.position.set(10, 20, 8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15 });
    this.scene.add(this.ambient, this.sun);

    this.buildIsland();
    this.water = new THREE.Mesh(
      new THREE.CylinderGeometry(ISLAND_RADIUS + 6, ISLAND_RADIUS + 6, 0.2, 64),
      new THREE.MeshStandardMaterial({ color: 0x3a8fb7, transparent: true, opacity: 0.75, roughness: 0.1 }),
    );
    this.scene.add(this.water);

    this.trees = new THREE.Group();
    this.creatureGroup = new THREE.Group();
    this.scene.add(this.trees, this.creatureGroup);
    this.particles = null;

    this.applySettings(settings);

    this.timer = new THREE.Timer();
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();

    Showcase.create(settings).then((showcase) => {
      if (this.disposed) return showcase.dispose();
      this.showcase = showcase;
      showcase.setGravity(this.settings.gravity);
      if (this.pendingGenomes) this.showCreatures(this.pendingGenomes);
    });

    this.renderer.setAnimationLoop((t) => this.frame(t));
  }

  buildIsland() {
    // Flat central arena where creatures roam, rising into hills at the rim.
    const geometry = new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS * 0.7, 3, 96, 1);
    geometry.translate(0, -1.5, 0);
    this.island = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x8b6a4a, roughness: 1 }));
    this.island.receiveShadow = true;

    this.grass = new THREE.Mesh(
      new THREE.CircleGeometry(ISLAND_RADIUS, 96, 0, Math.PI * 2),
      new THREE.MeshStandardMaterial({ color: 0x6fae5a, roughness: 0.9 }),
    );
    this.grass.rotation.x = -Math.PI / 2;
    this.grass.position.y = 0.01;
    this.grass.receiveShadow = true;

    this.hills = new THREE.Group();
    this.scene.add(this.island, this.grass, this.hills);
  }

  applySettings(settings) {
    const prev = this.settings;
    this.settings = settings;
    const light = LIGHTING[settings.timeOfDay];

    this.scene.background = new THREE.Color(light.sky);
    this.sun.color.set(light.sun);
    this.sun.intensity = light.intensity * (settings.weather === 'storm' ? 0.4 : 1);
    this.ambient.intensity = light.ambient;

    const fogDensity = { fog: 0.06, storm: 0.035, rain: 0.02, snow: 0.02, clear: 0.004 }[settings.weather];
    this.scene.fog = new THREE.FogExp2(light.sky, fogDensity);

    // Snowy ground when it's cold enough.
    this.grass.material.color.set(settings.temperature < 0 ? 0xeef3f7 : 0x6fae5a);

    // Water sits around the island and creeps onto it as waterLevel rises.
    this.water.position.y = -1.2 + settings.waterLevel * 1.4;

    if (!prev || prev.treeDensity !== settings.treeDensity || prev.temperature < 0 !== settings.temperature < 0) {
      this.buildTrees(settings);
    }
    if (!prev || prev.terrainRoughness !== settings.terrainRoughness) this.buildHills(settings.terrainRoughness);
    if (!prev || prev.weather !== settings.weather) this.buildParticles(settings.weather);

    this.showcase?.setGravity(settings.gravity);
  }

  buildTrees({ treeDensity, temperature }) {
    clearGroup(this.trees);
    const count = Math.round(treeDensity * 50);
    const trunkGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.8, 6);
    const leafGeo = new THREE.ConeGeometry(0.5, 1.4, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b3a21 });
    const leafMat = new THREE.MeshStandardMaterial({ color: temperature < 0 ? 0xdfeee6 : 0x2f7a3e, flatShading: true });
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = ARENA_RADIUS * 0.6 + Math.random() * (ISLAND_RADIUS - ARENA_RADIUS * 0.6 - 0.6);
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 0.4;
      const leaves = new THREE.Mesh(leafGeo, leafMat);
      leaves.position.y = 1.3;
      trunk.castShadow = leaves.castShadow = true;
      tree.add(trunk, leaves);
      tree.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
      tree.scale.setScalar(0.7 + Math.random() * 0.6);
      this.trees.add(tree);
    }
  }

  buildHills(roughness) {
    clearGroup(this.hills);
    const count = Math.round(roughness * 14);
    const mat = new THREE.MeshStandardMaterial({ color: 0x5f9a4c, flatShading: true });
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const size = 0.8 + Math.random() * 1.6 * roughness;
      const hill = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      hill.position.set(Math.cos(angle) * (ISLAND_RADIUS - 1.2), 0, Math.sin(angle) * (ISLAND_RADIUS - 1.2));
      hill.castShadow = hill.receiveShadow = true;
      this.hills.add(hill);
    }
  }

  buildParticles(weather) {
    if (this.particles) {
      this.scene.remove(this.particles);
      this.particles.geometry.dispose();
      this.particles.material.dispose();
      this.particles = null;
    }
    if (!['snow', 'rain', 'storm'].includes(weather)) return;

    const count = weather === 'snow' ? 2500 : 4000;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = Math.random() * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particles = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: weather === 'snow' ? 0xffffff : 0x9ab8d8,
        size: weather === 'snow' ? 0.12 : 0.05,
        transparent: true,
        opacity: 0.85,
      }),
    );
    this.particles.userData.speed = weather === 'snow' ? 1.5 : 12;
    this.scene.add(this.particles);
  }

  showCreatures(genomes) {
    if (!this.showcase) {
      this.pendingGenomes = genomes;
      return;
    }
    this.showcase.spawn(genomes);
    clearGroup(this.creatureGroup);
    this.creatureMeshes = this.showcase.creatures.map((creature) => {
      const material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color().setHSL(creature.genome.hue, 0.7, 0.6),
        roughness: 0.15,
        transmission: 0.4,
        thickness: 0.5,
        clearcoat: 1,
      });
      return creature.genome.nodes.map((node) => {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(node.radius, 24, 16), material);
        mesh.castShadow = true;
        this.creatureGroup.add(mesh);
        return mesh;
      });
    });
  }

  frame(timestamp) {
    this.timer.update(timestamp);
    const dt = this.timer.getDelta();
    if (this.showcase) {
      this.showcase.update(dt);
      this.showcase.creatures.forEach((creature, i) => {
        creature.bodies.forEach((body, j) => {
          const mesh = this.creatureMeshes?.[i]?.[j];
          if (!mesh) return;
          mesh.position.copy(body.translation());
          mesh.quaternion.copy(body.rotation());
        });
      });
    }

    if (this.particles) {
      const pos = this.particles.geometry.attributes.position;
      const fall = this.particles.userData.speed * dt;
      const drift = this.settings.windStrength * 4 * dt;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - fall;
        let x = pos.getX(i) + drift;
        if (y < -1) y = 20;
        if (x > 15) x = -15;
        pos.setXY(i, x, y);
      }
      pos.needsUpdate = true;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.resize);
    this.controls.dispose();
    this.showcase?.dispose();
    this.renderer.dispose();
  }
}

function clearGroup(group) {
  for (const child of [...group.children]) {
    group.remove(child);
    child.traverse((o) => o.geometry?.dispose());
  }
}
