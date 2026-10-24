import * as THREE from "three";

/**
 * Smooth camera following creature.
 */
export class SmoothCamera {
  constructor(camera) {
    this.camera = camera;
    this.targetPos = new THREE.Vector3(0, 3, 5);
    this.targetLookAt = new THREE.Vector3(0, 1, 0);
    this.smoothness = 0.1; // 0-1, higher = faster
  }

  /**
   * Update camera target (call every frame).
   * Heading is the creature's facing angle in the xz plane: forward = (cos h, 0, sin h).
   */
  updateTarget(creaturePos, creatureHeading) {
    // Offset: behind and above the creature, looking at it
    const offset = 2;
    const up = 2;
    this.targetPos.copy(creaturePos);
    this.targetPos.x -= Math.cos(creatureHeading) * offset;
    this.targetPos.y += up;
    this.targetPos.z -= Math.sin(creatureHeading) * offset;

    this.targetLookAt.copy(creaturePos);
    this.targetLookAt.y += 0.5;
  }

  /**
   * Smooth camera to target (call every frame).
   */
  update() {
    this.camera.position.lerp(this.targetPos, this.smoothness);
    this.camera.lookAt(this.targetLookAt);
  }
}
