import { createGameTextEffect } from "./_gameTextFactory";

export const effect = createGameTextEffect({
  id: "plasma-core-ignition",
  name: "Plasma Core Ignition",
  description: "等离子核心点火，电弧、粒子爆发和强光把文字烧亮。",
  layerSet: "plasma",
  palette: { accent: "#47faff", secondary: "#2b8cff", danger: "#ff9b2f", fill: "#eaffff" },
  powerId: "coreHeat",
  detailId: "sparkDensity",
  chaosId: "arcInstability",
  accentId: "plasmaColor",
  controls: [
    { type: "range", id: "coreHeat", label: "核心热量", defaultValue: 0.9, min: 0, max: 1, step: 0.01 },
    { type: "range", id: "sparkDensity", label: "火花密度", defaultValue: 0.82, min: 0, max: 1, step: 0.01 },
    { type: "range", id: "arcInstability", label: "电弧不稳定", defaultValue: 0.66, min: 0, max: 1, step: 0.01 },
    { type: "color", id: "plasmaColor", label: "等离子颜色", defaultValue: "#47faff" },
  ],
});

