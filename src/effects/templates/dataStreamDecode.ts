import { defineTextEffect, type TextEffectParams } from "../types";
import { clamp01, frameRandom, staggerProgress, windowFade } from "../utils/timing";
import { createLayer, drawLayer } from "../utils/layer";
import { drawRgbSplit } from "../utils/postprocess";

interface TextLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  ascent: number;
  descent: number;
  charWidths: number[];
  charPositions: number[];
}

const CHAR_POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789零一二三四五六七八九甲乙丙丁子丑寅卯#$%&<>[]{}+-*/_@!?^";

export const effect = defineTextEffect({
  id: "data-stream-decode",
  name: "Data Stream Decode",
  version: "1.0.0",
  description: "中英文字符逐个交错解码、伴随水平数据流穿梭与终端状态指示效果。",
  controls: [
    {
      type: "range",
      id: "intensity",
      label: "跳字/故障强度",
      defaultValue: 0.65,
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      type: "range",
      id: "glow",
      label: "发光强度",
      defaultValue: 0.45,
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      type: "range",
      id: "trail",
      label: "数据流强度",
      defaultValue: 0.5,
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      type: "range",
      id: "decoration",
      label: "周边小元素强度",
      defaultValue: 0.45,
      min: 0,
      max: 1,
      step: 0.01,
    },
  ],
  render(ctx, params) {
    const { width, height } = params;
    const totalFrames = Math.max(1, Math.round(params.duration * params.fps));
    const progress = clamp01(params.frame / Math.max(1, totalFrames - 1));

    // 1. 重置画布并渲染背景
    resetCanvas(ctx, width, height);
    drawBackground(ctx, params);

    // 2. 测量排版
    const layout = measureLayout(ctx, params);

    const trail = typeof params.custom.trail === "number" ? params.custom.trail : 0.5;

    // 3. 在文字底层绘制数据流穿梭 (Data Trails)
    if (trail > 0) {
      drawDataTrails(ctx, params, layout, progress, trail);
    }

    // 4. 计算交错解码，将文字画到离屏层
    const textLayer = createLayer(width, height);
    drawDecodedText(textLayer.ctx, params, layout, progress);

    // 5. 解码瞬间计算短暂的 RGB split 后处理
    const isDecoding = progress > 0.05 && progress < 0.78;
    const splitAmp = isDecoding
      ? frameRandom(params.seed, params.frame, 8) * params.intensity * 0.7
      : 0;

    const splitOffset = params.fontSize * 0.045 * splitAmp;
    const splitAlpha = 0.2 + splitAmp * 0.45;

    const postLayer = createLayer(width, height);
    drawRgbSplit(postLayer.ctx, textLayer.canvas, splitOffset, splitAlpha);

    // 绘制处理完毕的文字图层
    drawLayer(ctx, postLayer.canvas);

    // 6. 绘制周边的小终端元素装饰
    if (params.decoration > 0) {
      drawTerminalDeco(ctx, params, layout, progress);
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
  if (params.background === "transparent") {
    return;
  }

  if (params.background === "black") {
    ctx.fillStyle = "#010204";
    ctx.fillRect(0, 0, params.width, params.height);
    return;
  }

  // 暗邃的终端黑偏蓝黑
  ctx.fillStyle = "#04080f";
  ctx.fillRect(0, 0, params.width, params.height);

  // 绘制非常细微的微网格底纹
  ctx.save();
  ctx.strokeStyle = "rgba(0, 246, 255, 0.015)";
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x < params.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, params.height);
    ctx.stroke();
  }
  for (let y = 0; y < params.height; y += gridSize) {
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
  const charWidths: number[] = [];
  const charPositions: number[] = [];

  let currentX = 0;
  for (const char of chars) {
    charPositions.push(currentX);
    const width = ctx.measureText(char).width;
    charWidths.push(width);
    currentX += width;
  }

  const textWidth = currentX;
  const metrics = ctx.measureText(text);
  const ascent = metrics.actualBoundingBoxAscent || params.fontSize * 0.75;
  const descent = metrics.actualBoundingBoxDescent || params.fontSize * 0.25;

  const startX = (params.width - textWidth) / 2;

  const absolutePositions = charPositions.map((pos) => startX + pos);

  return {
    x: startX,
    y: params.height * 0.5 + (ascent - descent) / 2,
    width: textWidth,
    height: ascent + descent,
    ascent,
    descent,
    charWidths,
    charPositions: absolutePositions,
  };
}

/**
 * 绘制水平穿梭的高速数据流线 (Data Trails)
 */
function drawDataTrails(
  ctx: CanvasRenderingContext2D,
  params: TextEffectParams,
  layout: TextLayout,
  progress: number,
  trail: number
): void {
  const trailCount = Math.floor(10 * trail);
  if (trailCount === 0) return;

  const top = layout.y - layout.ascent;
  const areaHeight = layout.height;
  const speed = 25;

  ctx.save();
  ctx.fillStyle = params.color;

  for (let i = 0; i < trailCount; i += 1) {
    const saltY = i * 27;
    const saltX = i * 19;
    const saltW = i * 43;

    const y = top + frameRandom(params.seed, 0, saltY) * areaHeight;

    const baseOffset = frameRandom(params.seed, 0, saltX) * params.width;
    const speedOffset = params.frame * speed * (0.8 + frameRandom(params.seed, 0, saltX + 1) * 0.4);
    const lineX = (baseOffset + speedOffset) % (params.width + 300) - 150;

    const lineWidth = params.fontSize * (0.12 + frameRandom(params.seed, 0, saltW) * 0.38) * trail;
    const lineH = Math.max(1, Math.round(params.fontSize * 0.015 * (0.3 + frameRandom(params.seed, 0, saltW + 1) * 0.7)));

    const fade = windowFade(progress, 0, 0.85, 0.1);
    ctx.globalAlpha = fade * (0.08 + frameRandom(params.seed, params.frame, i) * 0.14);

    ctx.fillRect(lineX, Math.round(y), lineWidth, lineH);
  }

  ctx.restore();
}

/**
 * 逐字渲染处于各个解码状态的字符
 */
function drawDecodedText(
  ctx: CanvasRenderingContext2D,
  params: TextEffectParams,
  layout: TextLayout,
  progress: number
): void {
  ctx.font = `${params.fontWeight} ${params.fontSize}px ${params.fontFamily}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const chars = [...(params.text || " ")];
  const count = chars.length;
  const glow = clamp01(params.glow);

  const glowFreq = progress * Math.PI * 6;
  const glowPulse = 0.85 + Math.sin(glowFreq) * 0.15 * clamp01((progress - 0.4) / 0.4);

  for (let i = 0; i < count; i += 1) {
    const char = chars[i] ?? " ";
    const charX = layout.charPositions[i] ?? layout.x;

    const charProgress = staggerProgress(progress, i, count, 0.4);

    let renderChar = "";
    let renderColor = params.color;
    let alpha = 1;
    let textGlowBlur = 0;

    if (charProgress >= 0.99) {
      // 阶段 A: 已完全解码
      renderChar = char;
      alpha = 1.0;
      textGlowBlur = params.fontSize * (0.05 + glow * 0.12) * glowPulse;
    } else if (charProgress > 0.05) {
      // 阶段 B: 解码跳动中
      const isRandom = frameRandom(params.seed, params.frame, i * 7) > 0.22;
      if (isRandom) {
        const randIndex = Math.floor(frameRandom(params.seed, params.frame, i * 9) * CHAR_POOL.length);
        renderChar = CHAR_POOL[randIndex] ?? "_";
        renderColor = "#ffffff";
        alpha = 0.45 + frameRandom(params.seed, params.frame, i) * 0.45;
        textGlowBlur = params.fontSize * 0.08 * glow;
      } else {
        renderChar = char;
        alpha = 0.65;
        textGlowBlur = 0;
      }
    } else {
      // 阶段 C: 尚未解码
      const nearStart = charProgress > 0.0;
      if (nearStart) {
        const blink = frameRandom(params.seed, params.frame, i * 11) > 0.5;
        renderChar = blink ? "_" : " ";
        alpha = 0.28;
      } else {
        renderChar = " ";
        alpha = 0;
      }
    }

    if (alpha <= 0) continue;

    ctx.save();
    ctx.globalAlpha = alpha * clamp01(progress / 0.06);

    if (textGlowBlur > 0) {
      ctx.shadowColor = renderColor;
      ctx.shadowBlur = textGlowBlur;
    }

    ctx.fillStyle = renderColor;
    ctx.fillText(renderChar, charX, layout.y);

    if (charProgress >= 0.99) {
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillText(renderChar, charX, layout.y);
    }

    ctx.restore();
  }
}

/**
 * 绘制高科技终端命令行风格的周边小元素装饰
 */
function drawTerminalDeco(
  ctx: CanvasRenderingContext2D,
  params: TextEffectParams,
  layout: TextLayout,
  progress: number
): void {
  const deco = clamp01(params.decoration);
  const pad = params.fontSize * 0.35;
  const left = layout.x - pad;
  const right = layout.x + layout.width + pad;
  const top = layout.y - layout.ascent - pad;
  const bottom = layout.y + layout.descent + pad * 0.8;

  const areaWidth = right - left;
  const areaHeight = bottom - top;

  const blink = frameRandom(params.seed, params.frame, 99) > 0.45;

  ctx.save();
  ctx.strokeStyle = params.color;
  ctx.fillStyle = params.color;
  ctx.lineWidth = 1;
  ctx.font = `600 ${Math.max(10, Math.round(params.fontSize * 0.1))}px monospace`;

  // 1. 周边四角单像素微边框线
  ctx.globalAlpha = deco * 0.12 * clamp01(progress / 0.1);
  ctx.strokeRect(left, top, areaWidth, areaHeight);

  // 2. 左上角显示解码状态文字
  ctx.globalAlpha = deco * 0.65;
  const isFinished = progress >= 0.8;
  const statusText = isFinished
    ? `[SYSTEM: SECURE // DECRYPT_100%]`
    : `[DECRYPTING... SEED_${params.seed}]`;
  ctx.fillText(statusText, left, top - 8);

  // 3. 右下角显示编码校验值与帧数
  const checksum = (params.seed ^ params.frame * 2654435761).toString(16).substring(0, 8).toUpperCase();
  const infoText = `HEX:${checksum} // F:${params.frame.toString().padStart(3, "0")}`;
  ctx.fillText(infoText, right - ctx.measureText(infoText).width, bottom + 16);

  // 4. 左下角绘制一个微型条形进度格
  const barY = bottom + 8;
  const barW = 8;
  const barH = 5;
  const maxBars = 8;
  const filledBars = Math.floor(progress * maxBars);

  ctx.globalAlpha = deco * 0.45;
  for (let j = 0; j < maxBars; j += 1) {
    if (j < filledBars) {
      ctx.fillRect(left + j * 12, barY, barW, barH);
    } else {
      ctx.strokeRect(left + j * 12, barY, barW, barH);
    }
  }

  // 5. 在最后一个字后方画打字机光标块
  if (!isFinished) {
    const activeChars = [...(params.text || " ")];
    const cursorIdx = Math.min(activeChars.length - 1, Math.floor(progress * activeChars.length));
    const cursorX = layout.charPositions[cursorIdx] ?? layout.x;
    const charW = layout.charWidths[cursorIdx] ?? params.fontSize * 0.6;

    if (blink) {
      ctx.globalAlpha = deco * 0.8;
      ctx.fillRect(cursorX + charW + 2, layout.y - layout.ascent, params.fontSize * 0.12, layout.ascent);
    }
  }

  ctx.restore();
}
