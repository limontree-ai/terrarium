// Terrarium color palette. Every entry has three tones used for the faceted look:
// light (sun facing faces), mid (side faces), shadow (faces turned away from the sun).
import * as THREE from 'three';

export const PALETTE = {
  grass: { light: '#8FD16A', mid: '#6BB84F', shadow: '#4E9A3C' },
  foliage: { light: '#7CC95A', mid: '#4FA048', shadow: '#2F7A3E' },
  trunk: { light: '#A8754A', mid: '#8A5A3C', shadow: '#6B4430' },
  dirt: { light: '#B07A52', mid: '#8A5A3C', shadow: '#5E3B28' },
  sand: { light: '#F6DE8D', mid: '#EBC86E', shadow: '#CFA653' },
  shallowWater: { light: '#6FD3E8', mid: '#3FB4D9', shadow: '#2A94C4' },
  deepWater: { light: '#2E86C8', mid: '#1F6FB5', shadow: '#164F8C' },
  foam: { light: '#FFFFFF', mid: '#E6F7FB', shadow: '#C9EAF2' },
  snow: { light: '#FFFFFF', mid: '#EEF5FA', shadow: '#D3E3EE' },
  ice: { light: '#E3F6FF', mid: '#A8DDF2', shadow: '#6FBCE0' },
  rock: { light: '#C7C9CC', mid: '#9EA2A8', shadow: '#6F747B' },
  mud: { light: '#8A6447', mid: '#6B4A33', shadow: '#4A3222' },
  moonDust: { light: '#D9C9C9', mid: '#B9A3A6', shadow: '#8E787D' },
  lava: { light: '#FF8A3D', mid: '#E8562A', shadow: '#B83A1E' },
  fruit: { light: '#FF6B5B', mid: '#E8453C', shadow: '#B8302C' },
  cloud: { light: '#FFFFFF', mid: '#F1F5F9', shadow: '#D9E2EA' },
  // extras used by specific assets
  cutWood: { light: '#E6C08F', mid: '#D3A471', shadow: '#B8895C' },
  orangeFruit: { light: '#FFB45E', mid: '#FF8F2E', shadow: '#D96C1C' },
  sun: { light: '#FFF08A', mid: '#FFD93D', shadow: '#FFB82E' },
  moon: { light: '#FAF7EE', mid: '#E4E0D6', shadow: '#C2BEB4' },
  moonCrater: { light: '#CFCBC2', mid: '#BDB9AF', shadow: '#A8A49A' },
  bubble: { light: '#F2FCFF', mid: '#CFEFFA', shadow: '#A8DCEE' },
  seaweed: { light: '#5FD08A', mid: '#35AE6C', shadow: '#1F8A55' },
  pebble: { light: '#D8D2C4', mid: '#B5AD9C', shadow: '#8F8878' },
  reed: { light: '#B6D56A', mid: '#8DB84A', shadow: '#68933A' },
  cattail: { light: '#9A6A44', mid: '#7A4F30', shadow: '#5A3822' },
  leafAutumn: { light: '#FFB35A', mid: '#E8862E', shadow: '#B8601E' },
  crack: { light: '#FFFFFF', mid: '#FFFFFF', shadow: '#F2FAFF' },
  planetSea: { light: '#4AA0E0', mid: '#2F7FC4', shadow: '#1F5FA0' },
  planetLand: { light: '#8FD16A', mid: '#6BB84F', shadow: '#4E9A3C' },
};

export const FLOWER_COLORS = ['#FF6B8B', '#FFD84A', '#FFFFFF', '#B58CFF'];

// Sky gradients (top and horizon colors).
export const SKY = {
  day: { top: '#5FB3E8', horizon: '#CDEBF7' },
  sunset: { top: '#6B5BA8', horizon: '#F4A36B' },
  night: { top: '#1B2350', horizon: '#3C3F7A' },
  moon: { top: '#120F2A', horizon: '#5A3D6E' },
};

// Lighting presets per time of day.
export const LIGHTING = {
  day: { sun: '#FFF1CC', sunI: 2.4, amb: '#BFD9FF', ambI: 1.0, ground: '#A8D88B', stars: 0 },
  sunset: { sun: '#FFAA66', sunI: 1.9, amb: '#E9B3C8', ambI: 0.85, ground: '#C9906A', stars: 0.15 },
  night: { sun: '#9FB0FF', sunI: 0.7, amb: '#6F7FD0', ambI: 0.75, ground: '#3C3F7A', stars: 1 },
  moon: { sun: '#E8DCFF', sunI: 1.5, amb: '#9A78B8', ambI: 0.7, ground: '#5A3D6E', stars: 1 },
};

const _c = new THREE.Color();

// Auto build 3 tones from one base hex (used for flowers, fruit variants and so on).
export function makeTones(hex) {
  const base = new THREE.Color(hex);
  const hsl = {};
  base.getHSL(hsl, THREE.SRGBColorSpace);
  const mk = (dl, dh) => '#' + _c.setHSL((hsl.h + dh + 1) % 1, Math.min(1, hsl.s), Math.max(0, Math.min(1, hsl.l + dl)), THREE.SRGBColorSpace).getHexString(THREE.SRGBColorSpace);
  return { light: mk(0.1, 0.005), mid: '#' + base.getHexString(THREE.SRGBColorSpace), shadow: mk(-0.17, -0.015) };
}

// Convert a palette entry to THREE.Color objects (cached).
const _cache = new WeakMap();
export function colorsOf(p) {
  let c = _cache.get(p);
  if (!c) {
    c = { light: new THREE.Color(p.light), mid: new THREE.Color(p.mid), shadow: new THREE.Color(p.shadow) };
    _cache.set(p, c);
  }
  return c;
}
