import * as THREE from "three";

/**
 * Curved planet: the physics world is flat, and every vertex is bent down by its
 * horizontal distance from the curve center (the creature), so the horizon falls away
 * like a small planet while the ground right under the creature stays where physics puts it.
 */
export const DEFAULT_PLANET_RADIUS = 60;

export function createCurveUniforms(planetRadius = DEFAULT_PLANET_RADIUS) {
  return {
    planetRadius: { value: planetRadius },
    curveCenter: { value: new THREE.Vector3() },
  };
}

const CURVE_GLSL = /* glsl */ `
  uniform float planetRadius;
  uniform vec3 curveCenter;

  vec4 curveWorld(vec4 worldPos) {
    float dist = length(worldPos.xz - curveCenter.xz);
    float angle = min(dist / planetRadius, 1.5707963);
    worldPos.y += planetRadius * (cos(angle) - 1.0);
    return worldPos;
  }
`;

/**
 * Vertex shader: bends flat world to curved planet.
 */
export const curvedVertexShader = /* glsl */ `
  ${CURVE_GLSL}

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vDepth; // flat (physics) height, for water tint

  void main() {
    vec4 flatWorld = modelMatrix * vec4(position, 1.0);
    vDepth = flatWorld.y;

    vec4 worldPos = curveWorld(flatWorld);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vPosition = worldPos.xyz;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

/**
 * Fragment shader: simple diffuse lighting with water tint.
 */
export const curvedFragmentShader = /* glsl */ `
  uniform vec3 baseColor;
  uniform vec3 waterColor;
  uniform float waterLevel; // meters
  uniform vec3 lightDir;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vDepth;

  void main() {
    float diff = max(dot(normalize(vNormal), normalize(lightDir)), 0.3);
    vec3 color = baseColor * diff;

    if (waterLevel > 0.0 && vDepth < waterLevel) {
      color = mix(color, waterColor, 0.6);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

const CURVED_PROJECT_VERTEX = /* glsl */ `
  vec4 mvPosition = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    mvPosition = instanceMatrix * mvPosition;
  #endif
  mvPosition = viewMatrix * curveWorld( modelMatrix * mvPosition );
  gl_Position = projectionMatrix * mvPosition;
`;

/**
 * Make a built-in material (Phong, Standard, ...) follow the planet curve.
 */
export function applyCurve(material, curveUniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, curveUniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${CURVE_GLSL}`)
      .replace("#include <project_vertex>", CURVED_PROJECT_VERTEX);
  };
  return material;
}
