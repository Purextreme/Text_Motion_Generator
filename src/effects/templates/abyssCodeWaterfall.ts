import { createGameTextEffect } from "./_gameTextFactory";

export const effect = createGameTextEffect({
  id: "abyss-code-waterfall",
  name: "Abyss Code Waterfall",
  description: "深渊代码瀑布从文字内部流过，像黑客界面和游戏载入动画结合。",
  layerSet: "waterfall",
  palette: { accent: "#4dff92", secondary: "#00e5ff", danger: "#ff3168", fill: "#eafff2" },
  powerId: "codeGlow",
  detailId: "rainDensity",
  chaosId: "dataCorruption",
  accentId: "codeColor",
  controls: [
    { type: "range", id: "codeGlow", label: "代码发光", defaultValue: 0.8, min: 0, max: 1, step: 0.01 },
    { type: "range", id: "rainDensity", label: "代码密度", defaultValue: 0.9, min: 0, max: 1, step: 0.01 },
    { type: "range", id: "dataCorruption", label: "数据损坏", defaultValue: 0.58, min: 0, max: 1, step: 0.01 },
    { type: "color", id: "codeColor", label: "代码颜色", defaultValue: "#4dff92" },
  ],
});

