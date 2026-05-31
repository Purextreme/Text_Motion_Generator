import { createGameTextEffect } from "./_gameTextFactory";

export const effect = createGameTextEffect({
  id: "quantum-portal-title",
  name: "Quantum Portal Title",
  description: "量子传送门能量环在文字后方打开，粒子向中心坍缩并点亮标题。",
  layerSet: "portal",
  palette: { accent: "#8cfffb", secondary: "#6a5cff", danger: "#ff4bd8", fill: "#ffffff" },
  powerId: "portalEnergy",
  detailId: "ringDensity",
  chaosId: "phaseNoise",
  accentId: "portalColor",
  controls: [
    { type: "range", id: "portalEnergy", label: "传送门能量", defaultValue: 0.86, min: 0, max: 1, step: 0.01 },
    { type: "range", id: "ringDensity", label: "能量环密度", defaultValue: 0.84, min: 0, max: 1, step: 0.01 },
    { type: "range", id: "phaseNoise", label: "相位噪声", defaultValue: 0.46, min: 0, max: 1, step: 0.01 },
    { type: "color", id: "portalColor", label: "传送门颜色", defaultValue: "#8cfffb" },
  ],
});

