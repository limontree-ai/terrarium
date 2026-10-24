import React from "react";

const fixed = (v, digits = 2) => (Number.isFinite(v) ? v.toFixed(digits) : "–");

export function HUD({ roundData }) {
  if (!roundData) {
    return <div className="hud">Initializing...</div>;
  }

  const { traits, sigma, currentReward, adopted } = roundData;
  const round = roundData.round ?? roundData.roundNumber;

  return (
    <div className="hud">
      <div className="hud-row">
        <strong>Generation:</strong> {round}
      </div>
      <div className="hud-row">
        <strong>Reward:</strong> {fixed(currentReward)}
      </div>
      <div className="hud-row">
        <strong>Last round:</strong> {adopted ? "adopted" : "kept"}
      </div>
      <div className="hud-row">
        <strong>Sigma (diversity):</strong> {fixed(sigma, 3)}
      </div>
      <div className="hud-row">
        <strong>Limbs:</strong> {traits.limbCount}
      </div>
      <div className="hud-row">
        <strong>Height:</strong> {fixed(traits.height)}m
      </div>
      <div className="hud-row">
        <strong>Flatness:</strong> {fixed(traits.flatness)}
      </div>
    </div>
  );
}
