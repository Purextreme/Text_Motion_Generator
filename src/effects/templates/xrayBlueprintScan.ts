import { createGameTextEffect } from "./_gameTextFactory";

export const effect = createGameTextEffect({
  id: "xray-blueprint-scan",
  name: "X-Ray Blueprint Scan",
  description: "X-Ray 蓝图扫描文字，带测量线、网格、扫光和工程标注。",
  layerSet: "blueprint",
  palette: { accent: "#5cf3ff", secondary: "#94a3ff", danger: "#ff477e", fill: "#e6fdff" },
  powerId: "scanBeam",
  detailId: "blueprintDetail",
  chaosId: "xrayNoise",
  accentId: "blueprintColor",
  controls: [
    { type: "range", id: "scanBeam", label: "扫描光束", defaultValue: 0.8, min: 0, max: 1, step: 0.01 },
    { type: "range", id: "blueprintDetail", label: "蓝图细节", defaultValue: 0.9, min: 0, max: 1, step: 0.01 },
    { type: "range", id: "xrayNoise", label: "X-Ray 噪声", defaultValue: 0.35, min: 0, max: 1, step: 0.01 },
    { type: "color", id: "blueprintColor", label: "蓝图颜色", defaultValue: "#5cf3ff" },
  ],
});

