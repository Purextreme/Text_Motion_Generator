import { createGameTextEffect } from "./_gameTextFactory";

export const effect = createGameTextEffect({
  id: "cyber-neon-glitch-slicer",
  name: "Cyber Neon Glitch Slicer",
  description: "横向切片高速拼合，叠加 RGB 分离、VHS 横条、霓虹电压闪烁。",
  layerSet: "slicer",
  palette: { accent: "#00f6ff", secondary: "#7b4dff", danger: "#ff2364", fill: "#f5ffff" },
  powerId: "neonVoltage",
  detailId: "sliceCount",
  chaosId: "vhsDamage",
  accentId: "tubeColor",
  controls: [
    { type: "range", id: "neonVoltage", label: "霓虹电压", defaultValue: 0.88, min: 0, max: 1, step: 0.01 },
    { type: "range", id: "sliceCount", label: "切片复杂度", defaultValue: 0.78, min: 0, max: 1, step: 0.01 },
    { type: "range", id: "vhsDamage", label: "VHS 损坏", defaultValue: 0.72, min: 0, max: 1, step: 0.01 },
    { type: "color", id: "tubeColor", label: "灯管颜色", defaultValue: "#00f6ff" },
  ],
});

