import { defineTextEffect, type TextEffectParams } from "../types";
import { clamp, smoothstep, easeOutCubic } from "../../utils/easing";
import { frameRandom, staggerProgress, clamp01 } from "../utils/timing";
import { createLayer, drawLayer, withSavedContext } from "../utils/layer";
import { drawRgbSplit, drawScanlines } from "../utils/postprocess";

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

const CHAR_POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789零一二三四五六七八九甲乙丙丁子丑寅卯#$%&<>[]{}+-*/_@!?^|~";

export const effect = defineTextEffect({
  id: "digital-cascade",
  name: "Digital Cascade",
  version: "1.0.0",
  description: "数码瀑布效果，字符从上方坠落高速切换符号后锁定到位，终端黑客风格。",
  controls: [
    {
      type: "range",
      id: "intensity",
      label: "切换/故障强度",
      defaultValue: 0.7,
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      type: "range",
      id: "glow",
      label: "发光强度",
      defaultValue: 0.6,
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      type: "range",
      id: "fallSpeed",
      label: "下落速度",
      defaultValue: 0.5,
      min: 0.1,
      max: 1,
      step: 0.01,
    },
    {
      type: "range",
      id: "decoration",
      label: "终端装饰",
      defaultValue: 0.55,
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      type: "color",
      id: "cascadeColor",
      label: "数码颜色",
      defaultValue: "#33ff88",
    },
  ],
  render(ctx, params) {
    const { width, height } = params;
    const totalFrames = Math.max(1, Math.round(params.duration * params.fps));
    const progress = clamp01(params.frame / Math.max(1, totalFrames - 1));

    const cascadeColor = typeof params.custom.cascadeColor === "string" ? params.custom.cascadeColor : "#33ff88";
    const glow = clamp01(params.glow);
    const intensity = clamp01(params.intensity);
    const deco = clamp01(params.decoration);
    const fallSpeed = typeof params.custom.fallSpeed === "number" ? params.custom.fallSpeed : 0.5;

    resetCanvas(ctx, width, height);
    drawBackground(ctx, params, cascadeColor);

    const layout = measureLayout(ctx, params);
    const chars = [...(params.text || " ")];
    const count = chars.length;

    // 全局显现
    const globalAppear = smoothstep(0, 0.05, progress);

    // 先绘制下落的数码雨迹（在文字后面）
    if (intensity > 0) {
      drawRainTrails(ctx, params, layout, chars, progress, fallSpeed, cascadeColor, intensity);
    }

    // 主文字渲染：逐字 cascade
    const textLayer = createLayer(width, height);
    for (let i = 0; i < count; i += 1) {
      const char = chars[i] ?? " ";
      const charX = layout.charPositions[i] ?? layout.x;
      const charW = layout.charWidths[i] ?? params.fontSize * 0.6;

      const staggerAmount = 0.5 * (1 - fallSpeed * 0.5);
      const charProgress = staggerProgress(progress, i, count, staggerAmount);

      drawCascadeChar(textLayer.ctx, params, layout, char, charX, charW, i, charProgress, cascadeColor, glow, intensity, globalAppear);
    }

    // RGB 分裂后处理
    const splitAmount = params.fontSize * 0.02 * intensity * (1 - smoothstep(0.6, 0.8, progress));
    const postLayer = createLayer(width, height);
    drawRgbSplit(postLayer.ctx, textLayer.canvas, splitAmount, 0.2 + intensity * 0.25);
    drawLayer(ctx, postLayer.canvas);

    // 扫描线
    if (params.scanline > 0) {
      const pad = params.fontSize * 0.5;
      drawScanlines(ctx, {
        x: Math.max(0, layout.x - pad),
        y: Math.max(0, layout.y - layout.ascent - pad),
        width: Math.min(width - Math.max(0, layout.x - pad), layout.width + pad * 2),
        height: Math.min(height - Math.max(0, layout.y - layout.ascent - pad), layout.height + pad * 2),
      }, params.scanline * 0.16 * (params.background === "transparent" ? 0.65 : 1), Math.max(3, Math.round(params.fontSize * 0.075)), (params.frame * 0.4) % Math.max(3, Math.round(params.fontSize * 0.075)));
    }

    // 终端装饰
    if (deco > 0) {
      drawTerminalOverlay(ctx, params, layout, progress, cascadeColor, deco, glow);
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

function drawBackground(ctx: CanvasRenderingContext2D, params: TextEffectParams, accentColor: string): void {
  if (params.background === "transparent") return;

  if (params.background === "black") {
    ctx.fillStyle = "#010302";
    ctx.fillRect(0, 0, params.width, params.height);
  } else {
    const gradient = ctx.createRadialGradient(
      params.width * 0.5, params.height * 0.45, 0,
      params.width * 0.5, params.height * 0.5,
      Math.max(params.width, params.height) * 0.7,
    );
    gradient.addColorStop(0, "#02140a");
    gradient.addColorStop(0.5, "#010a05");
    gradient.addColorStop(1, "#000302");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, params.width, params.height);
  }

  // 微弱的竖向雨痕
  ctx.save();
  ctx.strokeStyle = accentColor.replace(")", ", 0.012)").replace("rgb", "rgba");
  ctx.lineWidth = 0.5;
  const colSpacing = 40;
  for (let x = colSpacing; x < params.width; x += colSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, params.height);
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
 * 数码雨迹：字符在下落过程中的残留拖尾
 */
function drawRainTrails(
  ctx: CanvasRenderingContext2D,
  params: TextEffectParams,
  layout: TextLayout,
  chars: string[],
  progress: number,
  fallSpeed: number,
  cascadeColor: string,
  intensity: number,
): void {
  const count = chars.length;
  const staggerAmount = 0.5 * (1 - fallSpeed * 0.5);

  ctx.save();
  ctx.font = `${params.fontWeight} ${params.fontSize}px ${params.fontFamily}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  for (let i = 0; i < count; i += 1) {
    const charProgress = staggerProgress(progress, i, count, staggerAmount);
    if (charProgress >= 0.98) continue;

    const charX = layout.charPositions[i] ?? layout.x;
    const charY = layout.y;

    // 雨滴轨迹：在字符上方有多层逐渐淡出的随机字符
    const trailLength = 5 + Math.floor(intensity * 8);
    for (let t = 0; t < trailLength; t += 1) {
      const trailOffset = (t + 1) * params.fontSize * 0.9;
      const trailY = charY - trailOffset;
      if (trailY < layout.y - layout.ascent - params.fontSize * 2) continue;

      const trailAlpha = (1 - t / trailLength) * intensity * 0.22 * (1 - charProgress);
      ctx.globalAlpha = trailAlpha;

      const randChar = getRandomChar(params.seed, params.frame * 3 + i * 47 + t * 13);
      ctx.fillStyle = cascadeColor;
      ctx.shadowColor = cascadeColor;
      ctx.shadowBlur = params.fontSize * 0.04;
      ctx.fillText(randChar, charX, trailY);
    }
  }

  ctx.restore();
}

/**
 * 单个 cascade 字符
 * 阶段：悬空（随机符号快速切换）→ 下落（带弹跳）→ 锁定（稳定发光）
 */
function drawCascadeChar(
  ctx: CanvasRenderingContext2D,
  params: TextEffectParams,
  layout: TextLayout,
  targetChar: string,
  charX: number,
  _charW: number,
  index: number,
  charProgress: number,
  cascadeColor: string,
  glow: number,
  intensity: number,
  globalAppear: number,
): void {
  if (targetChar === " " || charProgress <= 0) return;

  ctx.font = `${params.fontWeight} ${params.fontSize}px ${params.fontFamily}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const targetY = layout.y;

  // 下落阶段判断
  const fallPhase = charProgress < 0.7;
  const lockPhase = charProgress >= 0.7;

  let renderChar: string;
  let renderY: number;
  let alpha: number;
  let flashAlpha = 0;

  if (fallPhase) {
    // 下落中：在目标位置上方，随机字符高速切换
    const fallProgress = charProgress / 0.7;
    // 起始位置在目标上方 1.5~2 倍字高
    const startOffset = params.fontSize * (1.5 + frameRandom(params.seed, 0, index * 19) * 0.8);
    // 缓出下落（模拟重力 + 弹跳）
    const easedFall = easeOutCubic(fallProgress);
    const bounce = fallProgress > 0.85
      ? Math.sin((fallProgress - 0.85) / 0.15 * Math.PI * 2) * params.fontSize * 0.08 * (1 - fallProgress) / 0.15
      : 0;
    renderY = targetY - startOffset * (1 - easedFall) + bounce;

    // 随机字符高速闪烁
    const switchRate = 3 + intensity * 8;
    const charIndex = Math.floor(frameRandom(params.seed, params.frame * switchRate, index * 31) * CHAR_POOL.length);
    renderChar = CHAR_POOL[charIndex] ?? "_";

    alpha = 0.4 + intensity * 0.35;
    flashAlpha = 0;
  } else {
    // 锁定阶段：显示真实字符
    const lockProgress = (charProgress - 0.7) / 0.3;
    renderY = targetY;
    renderChar = targetChar;

    // 锁定初期有短暂闪烁
    const isFlashing = lockProgress < 0.2;
    if (isFlashing) {
      const showReal = frameRandom(params.seed, params.frame + index, index * 17) > 0.25;
      if (!showReal) {
        const ci = Math.floor(frameRandom(params.seed, params.frame, index * 53) * CHAR_POOL.length);
        renderChar = CHAR_POOL[ci] ?? "_";
      }
      flashAlpha = intensity * 0.4 * (1 - lockProgress / 0.2);
    }

    alpha = 1;
  }

  alpha *= globalAppear;
  if (alpha <= 0.005) return;

  // 锁定后的呼吸发光
  const breathe = lockPhase
    ? 0.9 + Math.sin(params.frame * 0.1 + index * 0.6 + params.seed) * 0.1
    : 1;
  const finalAlpha = alpha * breathe;

  // 外层发光
  ctx.save();
  ctx.globalAlpha = finalAlpha * (0.12 + glow * 0.22);
  ctx.shadowColor = cascadeColor;
  ctx.shadowBlur = params.fontSize * (0.2 + glow * 0.5);
  ctx.fillStyle = cascadeColor;
  ctx.fillText(renderChar, charX, renderY);
  ctx.restore();

  // 中层发光
  ctx.save();
  ctx.globalAlpha = finalAlpha * (0.35 + glow * 0.35);
  ctx.shadowColor = cascadeColor;
  ctx.shadowBlur = params.fontSize * (0.04 + glow * 0.1);
  ctx.fillStyle = cascadeColor;
  ctx.fillText(renderChar, charX, renderY);
  ctx.restore();

  // 核心白色
  ctx.save();
  ctx.globalAlpha = finalAlpha;
  ctx.fillStyle = "#eeffee";
  ctx.fillText(renderChar, charX, renderY);

  ctx.globalCompositeOperation = "source-atop";
  const sheen = ctx.createLinearGradient(charX, renderY - layout.ascent, charX, renderY + layout.descent);
  sheen.addColorStop(0, "#ffffff");
  sheen.addColorStop(0.35, cascadeColor);
  sheen.addColorStop(1, "#116622");
  ctx.fillStyle = sheen;
  ctx.fillRect(charX - 4, renderY - layout.ascent - 4, params.fontSize * 0.8, layout.height + 8);
  ctx.restore();

  // 锁定瞬间的白色闪光
  if (flashAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = flashAlpha * finalAlpha;
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = params.fontSize * 0.35;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(targetChar, charX, targetY);
    ctx.restore();
  }

  // 下落过程中的运动模糊线
  if (fallPhase && intensity > 0.3) {
    const fallProgress = charProgress / 0.7;
    if (fallProgress > 0.4) {
      ctx.save();
      ctx.globalAlpha = finalAlpha * intensity * 0.2;
      ctx.strokeStyle = cascadeColor;
      ctx.lineWidth = Math.max(1, params.fontSize * 0.02);
      const trailY = renderY - params.fontSize * 0.15;
      ctx.beginPath();
      ctx.moveTo(charX + params.fontSize * 0.25, renderY - params.fontSize * 0.3);
      ctx.lineTo(charX + params.fontSize * 0.25, trailY - params.fontSize * 0.6);
      ctx.stroke();
      ctx.restore();
    }
  }
}

/**
 * 终端覆盖层装饰
 */
function drawTerminalOverlay(
  ctx: CanvasRenderingContext2D,
  params: TextEffectParams,
  layout: TextLayout,
  progress: number,
  cascadeColor: string,
  deco: number,
  glow: number,
): void {
  const padX = params.fontSize * 0.3;
  const padY = params.fontSize * 0.24;
  const left = layout.x - padX;
  const right = layout.x + layout.width + padX;
  const top = layout.y - layout.ascent - padY;
  const bottom = layout.y + layout.descent + padY * 0.7;

  const blink = frameRandom(params.seed, params.frame >> 1, 88) > 0.4;
  const alpha = deco * smoothstep(0.08, 0.3, progress);

  const labelFontSize = Math.max(9, Math.round(params.fontSize * 0.09));

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = cascadeColor;
  ctx.strokeStyle = cascadeColor;
  ctx.font = `600 ${labelFontSize}px monospace`;
  ctx.shadowColor = cascadeColor;
  ctx.shadowBlur = params.fontSize * (0.02 + glow * 0.04);

  // 顶部：终端标题栏
  const titleText = "ROOT@DIGITAL:~$ ./decrypt --text";
  ctx.fillText(titleText, left, top - labelFontSize * 1.2);

  // 右侧：帧计数器
  const frameText = `FRAME_${params.frame.toString().padStart(4, "0")}`;
  const frameW = ctx.measureText(frameText).width;
  ctx.fillText(frameText, right - frameW, top - labelFontSize * 1.2);

  // 光标（闪烁）
  if (blink) {
    const titleW = ctx.measureText(titleText).width;
    ctx.fillRect(left + titleW + 2, top - labelFontSize * 1.8, params.fontSize * 0.08, labelFontSize * 1.1);
  }

  // 左侧：端口状态指示
  const statusY = layout.y - layout.ascent * 0.6;
  ctx.fillStyle = cascadeColor;
  ctx.globalAlpha = alpha * 0.7;
  const dotR = params.fontSize * 0.025;
  ctx.beginPath();
  ctx.arc(left - params.fontSize * 0.2, statusY, dotR, 0, Math.PI * 2);
  ctx.fill();

  // 闪烁状态点
  if (blink) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = params.fontSize * 0.12;
    ctx.beginPath();
    ctx.arc(left - params.fontSize * 0.2, statusY, dotR * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // 底部：解码进度
  ctx.globalAlpha = alpha * 0.55;
  const barY = bottom + labelFontSize * 1.5;
  const barW = right - left;
  const barH = Math.max(1, params.fontSize * 0.02);
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = cascadeColor;
  ctx.strokeRect(left, barY, barW, barH);

  // 分段进度块
  const segments = 10;
  const segW = (barW - 2) / segments;
  const filledSegs = Math.floor(smoothstep(0.05, 0.9, progress) * segments);
  for (let s = 0; s < filledSegs; s += 1) {
    ctx.fillRect(left + 1 + s * segW, barY + 0.5, segW - 1, barH - 1);
  }

  // 底部右侧：哈希校验
  const hash = (params.seed ^ params.frame * 0x9e3779b9).toString(16).substring(0, 6).toUpperCase();
  ctx.fillText(`CHECKSUM:0x${hash}`, left, barY + labelFontSize * 1.6);

  ctx.restore();
}

function getRandomChar(seed: number, salt: number): string {
  const idx = Math.floor(frameRandom(seed, 0, salt) * CHAR_POOL.length);
  return CHAR_POOL[idx] ?? "_";
}
