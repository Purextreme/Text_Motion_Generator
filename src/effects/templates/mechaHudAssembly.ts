import { createGameTextEffect } from "./_gameTextFactory";

export const effect = createGameTextEffect({
  id: "mecha-hud-assembly",
  name: "Mecha HUD Assembly",
  description: "机械 HUD 面板组装标题，适合机甲、硬件发布、游戏装备感文字。",
  layerSet: "mecha",
  palette: { accent: "#f7c45d", secondary: "#5ffcff", danger: "#ff4747", fill: "#fff5d7" },
  powerId: "servoLight",
  detailId: "panelDensity",
  chaosId: "mechanicalJitter",
  accentId: "panelLight",
  controls: [
    { type: "range", id: "servoLight", label: "伺服光强", defaultValue: 0.78, min: 0, max: 1, step: 0.01 },
    { type: "range", id: "panelDensity", label: "机械面板密度", defaultValue: 0.86, min: 0, max: 1, step: 0.01 },
    { type: "range", id: "mechanicalJitter", label: "机械抖动", defaultValue: 0.38, min: 0, max: 1, step: 0.01 },
    { type: "color", id: "panelLight", label: "面板灯色", defaultValue: "#f7c45d" },
  ],
});

