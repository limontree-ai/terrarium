import React from "react";

export function formatVal(v) {
  if (v === undefined || v === null) return "–";
  if (typeof v === "number") return v.toFixed(Math.abs(v) < 10 ? 2 : 0);
  return String(v);
}

export function ChangeCard({ setting, oldVal, newVal }) {
  return (
    <div className="change-card">
      <div className="setting-name">{setting}</div>
      <div className="setting-values">
        {formatVal(oldVal)} → {formatVal(newVal)}
      </div>
    </div>
  );
}
