import { createGameTextEffect } from "./_gameTextFactory";

export const effect = createGameTextEffect({
  id: "orbital-command-rings",
  name: "Orbital Command Rings",
  description: "轨道卫星环绕文字，形成科幻指挥中心式标题界面。",
  layerSet: "orbital",
  palette: { accent: "#7dd3ff", secondary: "#c084fc", danger: "#ff3d81", fill: "#f4fbff" },
  powerId: "orbitGlow",
  detailId: "satelliteCount",
  chaosId: "orbitalDrift",
  accentId: "orbitColor",
  controls: [
    { type: "range", id: "orbitGlow", label: "轨道发光", defaultValue: 0.78, min: 0, max: 1, step: 0.01 },
    { type: "range", id: "satelliteCount", label: "卫星刻度密度", defaultValue: 0.82, min: 0, max: 1, step: 0.01 },
    { type: "range", id: "orbitalDrift", label: "轨道漂移", defaultValue: 0.4, min: 0, max: 1, step: 0.01 },
    { type: "color", id: "orbitColor", label: "轨道颜色", defaultValue: "#7dd3ff" },
  ],
});

