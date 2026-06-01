import { defineTextEffect, type TextEffectParams } from "../types";
import { clamp, smoothstep, easeInOutCubic } from "../../utils/easing";
import { frameRandom, staggerProgress, clamp01, windowFade } from "../utils/timing";
import { createLayer, drawLayer, withSavedContext } from "../utils/layer";
import { drawRgbSplit } from "../utils/postprocess";

interface TextLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  ascent: number;
  descent: number;
  charPositions: number[];
  charWidths: number[];
}

export const effect = defineTextEffect({
  id: "circuit-trace",
  name: "Circuit Trace",
  version: "1.0.0",
  description: "激光蚀刻般的电路追踪效果，字符逐个通电亮起，节点闪烁，能量脉冲贯穿文字。",
  controls: [
    {
      type: "range",
      id: "intensity",
      label: "故障/闪烁强度",
      defaultValue: 0.6,
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      type: "range",
      id: "glow",
      label: "发光强度",
      defaultValue: 0.7,
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      type: "range",
      id: "traceSpeed",
      label: "蚀刻速度",
      defaultValue: 0.5,
      min: 0.1,
      max: 1,
      step: 0.01,
    },
    {
      type: "range",
      id: "decoration",
      label: "电路装饰",
      defaultValue: 0.65,
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      type: "color",
      id: "circuitColor",
      label: "电路主色",
      defaultValue: "#00e5ff",
    },
  ],
  render(ctx, params) {
    const { width, height } = params;
    const totalFrames = Math.max(1, Math.round(params.duration * params.fps));
    const progress = clamp01(params.frame / Math.max(1, totalFrames - 1));

    resetCanvas(ctx, width, height);
    drawBackground(ctx, params);

    const layout = measureLayout(ctx, params);
    const chars = [...(params.text || " ")];
    const count = chars.length;
    const circuitColor = typeof params.custom.circuitColor === "string" ? params.custom.circuitColor : "#00e5ff";
    const traceSpeed = typeof params.custom.traceSpeed === "number" ? params.custom.traceSpeed : 0.5;
    const glow = clamp01(params.glow);
    const deco = clamp01(params.decoration);
    const intensity = clamp01(params.intensity);

    // 全局可见度
    const globalAppear = smoothstep(0, 0.06, progress);

    // 电路连线（字符间）
    if (deco > 0 && count > 1) {
      drawCircuitConnections(ctx, params, layout, chars, progress, traceSpeed, circuitColor, deco, glow);
    }

    // 逐字渲染
    for (let i = 0; i < count; i += 1) {
      const char = chars[i] ?? " ";
      const charX = layout.charPositions[i] ?? layout.x;
      const charW = layout.charWidths[i] ?? params.fontSize * 0.6;

      // 交错进度：每个字符有独立的蚀刻时间窗口
      const staggerAmount = 0.55 * (1 - traceSpeed * 0.6);
      const charProgress = staggerProgress(progress, i, count, staggerAmount);

      drawTracedChar(ctx, params, layout, char, charX, charW, i, charProgress, circuitColor, glow, intensity, globalAppear);
    }

    // 全局能量脉冲（所有字符亮起后）
    if (progress > 0.6) {
      drawEnergyPulse(ctx, params, layout, progress, circuitColor, glow);
    }

    // 电路节点装饰
    if (deco > 0) {
      drawCircuitNodes(ctx, params, layout, progress, circuitColor, deco, glow);
    }
  },
});

function resetCanvas(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.shadowBlur = 0;
  ctx.clearRect(0, 0, width, height);
}

function drawBackground(ctx: CanvasRenderingContext2D, params: TextEffectParams): void {
  if (params.background === "transparent") return;

  if (params.background === "black") {
    ctx.fillStyle = "#010304";
    ctx.fillRect(0, 0, params.width, params.height);
  } else {
    const gradient = ctx.createRadialGradient(
      params.width * 0.5, params.height * 0.45, 0,
      params.width * 0.5, params.height * 0.5,
      Math.max(params.width, params.height) * 0.7,
    );
    gradient.addColorStop(0, "#04121f");
    gradient.addColorStop(0.5, "#010810");
    gradient.addColorStop(1, "#000308");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, params.width, params.height);
  }

  // 微妙的科技网格
  ctx.save();
  ctx.strokeStyle = "rgba(0, 180, 220, 0.025)";
  ctx.lineWidth = 0.5;
  const gs = 50;
  for (let x = gs; x < params.width; x += gs) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, params.height);
    ctx.stroke();
  }
  for (let y = gs; y < params.height; y += gs) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(params.width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function measureLayout(ctx: CanvasRenderingContext2D, params: TextEffectParams): TextLayout {
  ctx.font = `${params.fontWeight} ${params.fontSize}px ${params.fontFamily}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const text = params.text || " ";
  const chars = [...text];
  const charPositions: number[] = [];
  const charWidths: number[] = [];
  let cursorX = 0;

  for (const char of chars) {
    charPositions.push(cursorX);
    const w = ctx.measureText(char).width;
    charWidths.push(w);
    cursorX += w;
  }

  const metrics = ctx.measureText(text);
  const ascent = metrics.actualBoundingBoxAscent || params.fontSize * 0.75;
  const descent = metrics.actualBoundingBoxDescent || params.fontSize * 0.25;
  const startX = (params.width - cursorX) / 2;

  return {
    x: startX,
    y: params.height * 0.5 + (ascent - descent) / 2,
    width: cursorX,
    height: ascent + descent,
    ascent,
    descent,
    charPositions: charPositions.map((p) => startX + p),
    charWidths,
  };
}

/**
 * 绘制单个被蚀刻的字符
 * 字符经历三个阶段：暗 → 通电闪烁 → 稳定发光
 */
function drawTracedChar(
  ctx: CanvasRenderingContext2D,
  params: TextEffectParams,
  layout: TextLayout,
  char: string,
  charX: number,
  _charW: number,
  index: number,
  charProgress: number,
  circuitColor: string,
  glow: number,
  intensity: number,
  globalAppear: number,
): void {
  if (char === " " || charProgress <= 0) return;

  ctx.font = `${params.fontWeight} ${params.fontSize}px ${params.fontFamily}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // 通电阶段：字符刚开始出现时闪烁
  const powerOnDuration = 0.12;
  const isPoweringOn = charProgress > 0 && charProgress < powerOnDuration;
  const isStable = charProgress >= powerOnDuration;

  // 通电闪烁：快速随机开关
  let flicker = 1;
  if (isPoweringOn) {
    const flickerPhase = charProgress / powerOnDuration;
    flicker = frameRandom(params.seed, params.frame + index * 7, index * 13) > flickerPhase * 0.7 ? 1 : 0.15;
  }

  // 稳定发光阶段有微弱的呼吸效果
  const breathe = isStable
    ? 0.92 + Math.sin(params.frame * 0.12 + index * 0.7 + params.seed) * 0.08
    : 1;

  const alpha = globalAppear * flicker * breathe * clamp01(charProgress / 0.04);
  if (alpha <= 0.005) return;

  // 发光层（外层大光晕）
  ctx.save();
  ctx.globalAlpha = alpha * (0.14 + glow * 0.24);
  ctx.shadowColor = circuitColor;
  ctx.shadowBlur = params.fontSize * (0.18 + glow * 0.52);
  ctx.fillStyle = circuitColor;
  ctx.fillText(char, charX, layout.y);
  ctx.restore();

  // 中层发光
  ctx.save();
  ctx.globalAlpha = alpha * (0.38 + glow * 0.38);
  ctx.shadowColor = circuitColor;
  ctx.shadowBlur = params.fontSize * (0.04 + glow * 0.1);
  ctx.fillStyle = circuitColor;
  ctx.fillText(char, charX, layout.y);
  ctx.restore();

  // 顶层亮白核心
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(char, charX, layout.y);

  ctx.globalCompositeOperation = "source-atop";
  const sheen = ctx.createLinearGradient(charX, layout.y - layout.ascent, charX, layout.y + layout.descent);
  sheen.addColorStop(0, "#ffffff");
  sheen.addColorStop(0.35, circuitColor);
  sheen.addColorStop(1, "#0078aa");
  ctx.fillStyle = sheen;
  ctx.fillRect(charX - 4, layout.y - layout.ascent - 4, params.fontSize * 0.8, layout.height + 8);
  ctx.restore();

  // 通电瞬间的白色闪光
  if (isPoweringOn && flicker > 0.9 && intensity > 0.3) {
    ctx.save();
    ctx.globalAlpha = alpha * intensity * 0.5;
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = params.fontSize * 0.3;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(char, charX, layout.y);
    ctx.restore();
  }

  // 微弱的RGB分裂（仅在通电阶段）
  if (isPoweringOn && intensity > 0.4) {
    const splitAmount = params.fontSize * 0.025 * intensity * (1 - charProgress / powerOnDuration);
    const layer = createLayer(params.width, params.height);
    layer.ctx.font = `${params.fontWeight} ${params.fontSize}px ${params.fontFamily}`;
    layer.ctx.textAlign = "left";
    layer.ctx.textBaseline = "alphabetic";
    layer.ctx.fillStyle = "#ffffff";
    layer.ctx.fillText(char, charX, layout.y);
    drawRgbSplit(ctx, layer.canvas, splitAmount, 0.3 * alpha * intensity);
  }
}

/**
 * 字符间的电路连线
 * 用直角折线连接相邻字符的 top 和 bottom 位置
 */
function drawCircuitConnections(
  ctx: CanvasRenderingContext2D,
  params: TextEffectParams,
  layout: TextLayout,
  chars: string[],
  progress: number,
  traceSpeed: number,
  circuitColor: string,
  deco: number,
  glow: number,
): void {
  const staggerAmount = 0.55 * (1 - traceSpeed * 0.6);
  const count = chars.length;

  ctx.save();
  ctx.strokeStyle = circuitColor;
  ctx.lineWidth = Math.max(1, params.fontSize * 0.012);
  ctx.shadowColor = circuitColor;
  ctx.shadowBlur = params.fontSize * (0.02 + glow * 0.04);

  for (let i = 0; i < count - 1; i += 1) {
    const cp = staggerProgress(progress, i, count, staggerAmount);
    // 连线在当前字符通电后才开始绘制
    const lineProgress = clamp01((cp - 0.15) / 0.3);
    if (lineProgress <= 0) continue;

    const x1 = (layout.charPositions[i] ?? layout.x) + (layout.charWidths[i] ?? 0);
    const x2 = layout.charPositions[i + 1] ?? layout.x;
    const midX = (x1 + x2) / 2;
    const topY = layout.y - layout.ascent * 0.5;
    const botY = layout.y + layout.descent * 0.5;

    // 锯齿形电路连线：上 → 中 → 下 → 中 → 上
    const alpha = lineProgress * deco * 0.5;
    ctx.globalAlpha = alpha;

    // 上路径：右 → 中上 → 中
    const segCount = 3;
    const segIndex = Math.min(segCount - 1, Math.floor(lineProgress * segCount));
    const segProgress = clamp01(lineProgress * segCount - segIndex);

    ctx.beginPath();
    if (segIndex >= 0) {
      ctx.moveTo(x1, topY);
      ctx.lineTo(x1 + (midX - x1) * (segIndex >= 1 ? 1 : segProgress), topY);
    }
    if (segIndex >= 1) {
      ctx.lineTo(midX, topY + (layout.y - topY) * (segIndex >= 2 ? 1 : segProgress));
    }
    ctx.stroke();

    // 下路径（反向）：左 → 中下
    ctx.beginPath();
    if (segIndex >= 0) {
      ctx.moveTo(x2, botY);
      ctx.lineTo(x2 - (x2 - midX) * (segIndex >= 1 ? 1 : segProgress), botY);
    }
    if (segIndex >= 1) {
      ctx.lineTo(midX, botY - (botY - layout.y) * (segIndex >= 2 ? 1 : segProgress));
    }
    ctx.stroke();

    // 连线中点的小节点
    if (lineProgress > 0.8) {
      ctx.fillStyle = circuitColor;
      ctx.shadowBlur = params.fontSize * (0.06 + glow * 0.1);
      const nodeSize = Math.max(2, params.fontSize * 0.03);
      ctx.fillRect(midX - nodeSize / 2, layout.y - nodeSize / 2, nodeSize, nodeSize);
    }
  }

  ctx.restore();
}

/**
 * 全局能量脉冲波
 * 所有字符亮起后，一道光波从左到右扫过文字
 */
function drawEnergyPulse(
  ctx: CanvasRenderingContext2D,
  params: TextEffectParams,
  layout: TextLayout,
  progress: number,
  circuitColor: string,
  glow: number,
): void {
  const pulsePhase = (progress - 0.6) / 0.4;
  const pulseCount = Math.floor(pulsePhase * 3);
  const pulseProgress = (pulsePhase * 3) % 1;

  ctx.save();

  for (let p = 0; p <= pulseCount; p += 1) {
    const pp = p === pulseCount ? pulseProgress : 1;
    const pulseX = layout.x + layout.width * pp;
    const pulseWidth = params.fontSize * 0.5;
    const pulseAlpha = windowFade(pulseX, layout.x - pulseWidth, layout.x + layout.width + pulseWidth, 0.15) * 0.3;

    // 垂直光柱
    const grad = ctx.createLinearGradient(pulseX - pulseWidth, 0, pulseX + pulseWidth, 0);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(0.4, circuitColor);
    grad.addColorStop(0.5, "#ffffff");
    grad.addColorStop(0.6, circuitColor);
    grad.addColorStop(1, "transparent");

    ctx.globalAlpha = pulseAlpha * glow;
    ctx.fillStyle = grad;
    ctx.fillRect(pulseX - pulseWidth, layout.y - layout.ascent - 8, pulseWidth * 2, layout.height + 16);
  }

  ctx.restore();
}

/**
 * 电路节点装饰：文字区域四角的 L 形标线、漂浮小方块
 */
function drawCircuitNodes(
  ctx: CanvasRenderingContext2D,
  params: TextEffectParams,
  layout: TextLayout,
  progress: number,
  circuitColor: string,
  deco: number,
  glow: number,
): void {
  const padX = params.fontSize * 0.25;
  const padY = params.fontSize * 0.22;
  const left = layout.x - padX;
  const right = layout.x + layout.width + padX;
  const top = layout.y - layout.ascent - padY;
  const bottom = layout.y + layout.descent + padY * 0.6;
  const corner = params.fontSize * 0.14;
  const tickLen = params.fontSize * 0.22;

  const flicker = 0.78 + frameRandom(params.seed, params.frame >> 1, 77) * 0.22;
  const alpha = deco * flicker * smoothstep(0.05, 0.35, progress);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = circuitColor;
  ctx.fillStyle = circuitColor;
  ctx.lineWidth = Math.max(1.5, params.fontSize * 0.016);
  ctx.shadowColor = circuitColor;
  ctx.shadowBlur = params.fontSize * (0.03 + glow * 0.07);

  // 四角 L 形线
  drawCorner(ctx, left, top, corner, 1, 1);
  drawCorner(ctx, right, top, corner, -1, 1);
  drawCorner(ctx, left, bottom, corner, 1, -1);
  drawCorner(ctx, right, bottom, corner, -1, -1);

  // 左右侧的水平刻度线
  const midY = layout.y - layout.ascent * 0.15;
  ctx.beginPath();
  ctx.moveTo(left - tickLen, midY);
  ctx.lineTo(left - tickLen * 0.3, midY);
  ctx.moveTo(right + tickLen * 0.3, midY);
  ctx.lineTo(right + tickLen, midY);
  ctx.stroke();

  // 刻度线末端的小方块
  const sq = Math.max(3, params.fontSize * 0.04);
  ctx.fillRect(left - tickLen - sq * 1.5, midY - sq / 2, sq, sq);
  ctx.fillRect(right + tickLen + sq * 1.3, midY - sq / 2, sq, sq);

  // 顶部中央的菱形指示器
  const diamondX = (left + right) / 2;
  const diamondY = top - params.fontSize * 0.2;
  ctx.save();
  ctx.globalAlpha = alpha * 0.6;
  ctx.beginPath();
  ctx.moveTo(diamondX, diamondY - sq * 1.5);
  ctx.lineTo(diamondX + sq * 1.2, diamondY);
  ctx.lineTo(diamondX, diamondY + sq * 1.5);
  ctx.lineTo(diamondX - sq * 1.2, diamondY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 底部进度条
  const barY = bottom + 10;
  const barW = layout.width * 0.3;
  const barH = 2;
  const barX = layout.x + (layout.width - barW) / 2;
  ctx.globalAlpha = alpha * 0.45;
  ctx.strokeStyle = circuitColor;
  ctx.lineWidth = 0.5;
  ctx.strokeRect(barX, barY, barW, barH);
  ctx.fillRect(barX + 1, barY + 0.5, (barW - 2) * smoothstep(0.1, 0.8, progress), barH - 1);

  ctx.restore();
}

function drawCorner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  xDir: 1 | -1,
  yDir: 1 | -1,
): void {
  ctx.beginPath();
  ctx.moveTo(x, y + yDir * size);
  ctx.lineTo(x, y);
  ctx.lineTo(x + xDir * size, y);
  ctx.stroke();
}
