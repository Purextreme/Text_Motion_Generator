import { createGameTextEffect } from "./_gameTextFactory";

export const effect = createGameTextEffect({
  id: "reactor-shockwave-burst",
  name: "Reactor Shockwave Burst",
  description: "反应堆冲击波从文字中心爆开，带网格、粒子和循环能量波。",
  layerSet: "reactor",
  palette: { accent: "#53ffb7", secondary: "#39a7ff", danger: "#ffec4a", fill: "#eafff8" },
  powerId: "reactorOutput",
  detailId: "gridComplexity",
  chaosId: "coreSurge",
  accentId: "reactorColor",
  controls: [
    { type: "range", id: "reactorOutput", label: "反应堆输出", defaultValue: 0.88, min: 0, max: 1, step: 0.01 },
    { type: "range", id: "gridComplexity", label: "能量网格复杂度", defaultValue: 0.76, min: 0, max: 1, step: 0.01 },
    { type: "range", id: "coreSurge", label: "核心涌动", defaultValue: 0.52, min: 0, max: 1, step: 0.01 },
    { type: "color", id: "reactorColor", label: "反应堆颜色", defaultValue: "#53ffb7" },
  ],
});

