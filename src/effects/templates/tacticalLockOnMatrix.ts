import { createGameTextEffect } from "./_gameTextFactory";

export const effect = createGameTextEffect({
  id: "tactical-lock-on-matrix",
  name: "Tactical Lock-on Matrix",
  description: "游戏瞄准系统锁定文字，带雷达、红色警戒框、能量条和屏幕干扰。",
  layerSet: "lockon",
  palette: { accent: "#37f8ff", secondary: "#8bff5f", danger: "#ff335f", fill: "#e9ffff" },
  powerId: "targetPulse",
  detailId: "hudComplexity",
  chaosId: "signalShake",
  accentId: "radarColor",
  controls: [
    { type: "range", id: "targetPulse", label: "锁定脉冲", defaultValue: 0.82, min: 0, max: 1, step: 0.01 },
    { type: "range", id: "hudComplexity", label: "战术界面复杂度", defaultValue: 0.86, min: 0, max: 1, step: 0.01 },
    { type: "range", id: "signalShake", label: "信号抖动", defaultValue: 0.52, min: 0, max: 1, step: 0.01 },
    { type: "color", id: "radarColor", label: "雷达颜色", defaultValue: "#37f8ff" },
  ],
});

