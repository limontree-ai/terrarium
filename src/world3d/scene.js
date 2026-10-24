import * as THREE from "three";
import {
  curvedVertexShader,
  curvedFragmentShader,
  createCurveUniforms,
  applyCurve,
} from "./shaders.js";

const GRASS_COLOR = 0x2ecc71;
const SNOW_COLOR = new THREE.Color(0xffffff);
const WATER_HEIGHT_PER_LEVEL = 10; // matches physics: underwater when y < waterLevel * 10

/**
 * Create the Three.js scene with curved world.
 */
export function createScene(width, height) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e); // dark blue sky
  scene.fog = new THREE.Fog(0x1a1a2e, 100, 200);

  // Lighting
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(10, 15, 10);
  sun.name = "sun";
  sun.castShadow = true;
  scene.add(sun);

  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);

  // Camera
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.set(0, 3, 5);
  camera.lookAt(0, 1, 0);

  const renderer = createRenderer(width, height);
  const curveUniforms = createCurveUniforms();

  // Ground mesh (flat geometry, curved in the shader)
  const groundGeom = new THREE.PlaneGeometry(100, 100, 200, 200);
  groundGeom.rotateX(-Math.PI / 2);
  const groundMat = new THREE.ShaderMaterial({
    uniforms: {
      ...curveUniforms,
      baseColor: { value: new THREE.Color(GRASS_COLOR) },
      waterColor: { value: new THREE.Color(0x3498db) },
      waterLevel: { value: 0 },
      lightDir: { value: sun.position.clone().normalize() },
    },
    vertexShader: curvedVertexShader,
    fragmentShader: curvedFragmentShader,
  });
  const ground = new THREE.Mesh(groundGeom, groundMat);
  scene.add(ground);

  // Water surface (hidden while the island is dry)
  const waterGeom = new THREE.PlaneGeometry(100, 100, 100, 100);
  waterGeom.rotateX(-Math.PI / 2);
  const waterMat = applyCurve(
    new THREE.MeshPhongMaterial({
      color: 0x3498db,
      emissive: 0x1a5a7d,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    }),
    curveUniforms
  );
  const water = new THREE.Mesh(waterGeom, waterMat);
  water.visible = false;
  scene.add(water);

  return {
    scene,
    camera,
    renderer,
    ground,
    groundMat,
    water,
    curveUniforms,
    waterLevel: 0,
    snowDepth: 0,
  };
}

/**
 * Center the planet curve on the creature (call every frame).
 */
export function setCurveCenter(state, position) {
  state.curveUniforms.curveCenter.value.set(position.x, 0, position.z);
}

/**
 * Update world visuals (water, snow, lighting). Applies immediately.
 */
export function updateWorldVisuals(state, settings) {
  // Water level
  const waterHeight = (settings.waterLevel || 0) * WATER_HEIGHT_PER_LEVEL;
  state.groundMat.uniforms.waterLevel.value = waterHeight;
  state.water.position.y = waterHeight;
  state.water.visible = waterHeight > 0;
  state.waterLevel = settings.waterLevel || 0;

  // Snow: whiten terrain
  const snowFactor = (settings.snowDepth || 0) / 0.3;
  state.groundMat.uniforms.baseColor.value
    .setHex(GRASS_COLOR)
    .lerp(SNOW_COLOR, snowFactor * 0.5);
  state.snowDepth = settings.snowDepth || 0;

  // Time of day (simple)
  const lightColor = settings.timeOfDay === "night" ? 0x445588 : 0xffffff;
  state.scene.getObjectByName("sun").color.setHex(lightColor);
}

/**
 * Render one frame.
 */
export function render(state) {
  state.renderer.render(state.scene, state.camera);
}

/**
 * Handle window resize.
 */
export function onWindowResize(state) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  state.camera.aspect = width / height;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(width, height);
}

function createRenderer(width, height) {
  if (typeof WebGLRenderingContext === "undefined") return createNullRenderer();
  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.shadowMap.enabled = true;
    return renderer;
  } catch (err) {
    console.warn("WebGL unavailable, rendering disabled:", err.message);
    return createNullRenderer();
  }
}

// Stand-in with the same calls as WebGLRenderer, for tests and machines without WebGL.
function createNullRenderer() {
  return {
    isNullRenderer: true,
    domElement: typeof document !== "undefined" ? document.createElement("canvas") : null,
    shadowMap: { enabled: false },
    setSize() {},
    setPixelRatio() {},
    render() {},
    dispose() {},
  };
}
