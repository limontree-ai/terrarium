import * as config from "../config.js";

/**
 * Create a neural network from genome weights.
 */
export function createBrain(genome) {
  const weights = genome.brain; // Float32Array(616)

  // Layout:
  // [0-463]:   input-to-hidden (29*16 = 464)
  // [464-591]: hidden-to-output (16*8 = 128)
  // [592-607]: hidden biases (16)
  // [608-615]: output biases (8)

  function forward(inputs) {
    // inputs: Float32Array(29)

    // Hidden layer
    const hidden = new Float32Array(16);
    for (let h = 0; h < 16; h++) {
      let sum = weights[592 + h]; // bias
      for (let i = 0; i < 29; i++) {
        sum += inputs[i] * weights[i * 16 + h];
      }
      hidden[h] = Math.tanh(sum); // tanh activation
    }

    // Output layer
    const outputs = new Float32Array(8);
    for (let o = 0; o < 8; o++) {
      let sum = weights[608 + o]; // bias
      for (let h = 0; h < 16; h++) {
        sum += hidden[h] * weights[464 + h * 8 + o];
      }
      outputs[o] = sum; // linear activation
    }

    return outputs;
  }

  return { forward };
}
