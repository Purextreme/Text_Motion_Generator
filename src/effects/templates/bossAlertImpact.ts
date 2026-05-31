import { createGameTextEffect } from "./_gameTextFactory";

export const effect = createGameTextEffect({
  id: "boss-alert-impact",
  name: "Boss Alert Impact",
  description: "游戏 Boss 警报式标题，红色警戒条、伤害数字和强烈故障冲击。",
  layerSet: "boss",
  palette: { accent: "#ffd15c", secondary: "#ffffff", danger: "#ff1f45", fill: "#fff0d2" },
  powerId: "impactForce",
  detailId: "combatOverlays",
  chaosId: "damageGlitch",
  accentId: "alertColor",
  controls: [
    { type: "range", id: "impactForce", label: "冲击力度", defaultValue: 0.88, min: 0, max: 1, step: 0.01 },
    { type: "range", id: "combatOverlays", label: "战斗叠层", defaultValue: 0.76, min: 0, max: 1, step: 0.01 },
    { type: "range", id: "damageGlitch", label: "损坏故障", defaultValue: 0.82, min: 0, max: 1, step: 0.01 },
    { type: "color", id: "alertColor", label: "警报颜色", defaultValue: "#ffd15c" },
  ],
});

