/**
 * Terrarium data contracts: TypeScript-like JSDoc types.
 * These define the shape of all data structures.
 */

/**
 * @typedef {Object} WorldSettings
 * @property {number} waterLevel - 0 to 1
 * @property {number} snowDepth - 0 to 0.3 meters
 * @property {number} mud - 0 to 1 normalized
 * @property {number} rain - 0 to 1
 * @property {Object} wind
 * @property {number} wind.strength - 0 to 1
 * @property {number} wind.direction - 0 to 360 degrees
 * @property {number} gravity - 0.16 to 2.0
 * @property {string} groundType - "grass" | "sand" | "ice" | "mud" | "moondust"
 * @property {number} treeCount - 0 to many
 * @property {number} food - sparseness setting
 * @property {string} timeOfDay - "day" | "sunset" | "night"
 */
export const WorldSettings = {};

/**
 * @typedef {Object} Segment
 * @property {number} length - 0.1 to 0.8 meters
 * @property {number} width - 0.05 to 0.5 meters
 * @property {number} thickness - 0.03 to 0.3 meters
 * @property {number} axis - 0, 1, or 2 (x, y, z hinge axis)
 * @property {number} minAngle - degrees
 * @property {number} maxAngle - degrees
 * @property {number} strength - motor strength 0.1-10
 */
export const Segment = {};

/**
 * @typedef {Object} Genome
 * @property {Object} core
 * @property {number} core.sizeA - first core box size
 * @property {number} core.sizeB - second core box size
 * @property {Object[]} limbs - up to 4 limbs
 * @property {Segment[][]} limbs.segments - up to 3 segments per limb
 * @property {number} density - 400-1200 kg/m³
 * @property {number} rhythmHz - 0.5-3.0
 * @property {Float32Array} brain - 616 weights
 * @property {number} sigma - current mutation sigma
 */
export const Genome = {};

/**
 * @typedef {Object} TrialResult
 * @property {number} reward - total fitness score
 * @property {number} progress - meters toward food
 * @property {number} foodEaten - count
 * @property {number} energy - total energy used
 * @property {boolean} failed - physics blowup
 */
export const TrialResult = {};

/**
 * @typedef {Object} RoundMessage
 * @property {string} type - "round"
 * @property {number} round - generation number
 * @property {number} currentReward - best genome score
 * @property {number} bestReward - best variation score
 * @property {boolean} adopted - did we adopt?
 * @property {number} sigma - current mutation sigma
 * @property {Object} traits - limbCount, segmentCount, flatness, limbLength, height
 * @property {Genome} genome - current genome
 * @property {boolean} bodyChanged - did body mutate?
 */
export const RoundMessage = {};

/**
 * Worker messages
 *
 * Main → Worker:
 *   { type: 'start', genome, settings }
 *   { type: 'settings', settings }
 *   { type: 'position', position, heading, foodTarget }
 *
 * Worker → Main:
 *   { type: 'round', round, currentReward, bestReward, adopted, sigma, traits, genome, bodyChanged }
 */
export const WorkerMessages = {};
