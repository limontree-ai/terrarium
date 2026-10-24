import * as THREE from "three";

/**
 * Smooth camera following creature.
 */
export class SmoothCamera {
  constructor(camera, { offset = 2, up = 2 } = {}) {
    this.camera = camera;
    this.offset = offset; // meters behind the creature
    this.up = up; // meters above it
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
    const { offset, up } = this;
    this.targetPos.copy(creaturePos);
    this.targetPos.x -= Math.cos(creatureHeading) * offset;
    this.targetPos.y += up;
    this.targetPos.z -= Math.sin(creatureHeading) * offset;

    // Look slightly ahead of the creature so the world in front of it is visible.
    this.targetLookAt.copy(creaturePos);
    this.targetLookAt.x += Math.cos(creatureHeading) * 3;
    this.targetLookAt.y += 0.5;
    this.targetLookAt.z += Math.sin(creatureHeading) * 3;
  }

  /**
   * Smooth camera to target (call every frame).
   */
  update() {
    this.camera.position.lerp(this.targetPos, this.smoothness);
    this.camera.lookAt(this.targetLookAt);
  }
}
