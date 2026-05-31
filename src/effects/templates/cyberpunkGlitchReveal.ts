import type { TextEffectParams } from "../types";
import { defineTextEffect } from "../types";
import { clamp, easeOutCubic, smoothstep } from "../../utils/easing";
import { randomFromSeed, seededValue } from "../../utils/seededRandom";

const CHAR_POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789零一二三四五六七八九甲乙丙丁子丑寅卯#$%&<>[]{}+-*/_";

interface TextLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  ascent: number;
  descent: number;
}

export const effect = defineTextEffect({
  id: "cyberpunk-glitch-reveal",
  name: "Cyberpunk Glitch Reveal",
  version: "1.0.0",
  description: "中文优先的解码出现、短促故障、RGB 分离和霓虹发光文字效果。",
  render(ctx, params) {
    const { width, height } = params;
    const totalFrames = Math.max(1, Math.round(params.duration * params.fps));
    const progress = clamp(params.frame / Math.max(1, totalFrames - 1));
    const revealProgress = easeOutCubic(progress);
    const glitch = getGlitchState(params, progress);

    resetCanvas(ctx, width, height);
    drawBackground(ctx, params);

    const layout = measureLayout(ctx, params);
    const displayText = buildDecodedText(params, revealProgress);
    const layer = renderTextLayer(params, displayText, layout, progress);

    if (params.decoration > 0) {
      drawHud(ctx, params, layout, progress, glitch.amount);
    }

    drawTextComposite(ctx, layer, params, glitch);
    drawScanlines(ctx, params, layout, progress);
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
    ctx.fillStyle = "#020304";
    ctx.fillRect(0, 0, params.width, params.height);
    return;
  }

  const gradient = ctx.createRadialGradient(
    params.width * 0.5,
    params.height * 0.48,
    0,
    params.width * 0.5,
    params.height * 0.5,
    Math.max(params.width, params.height) * 0.65,
  );
  gradient.addColorStop(0, "#07172a");
  gradient.addColorStop(0.48, "#03101f");
  gradient.addColorStop(1, "#010711");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, params.width, params.height);
}

function measureLayout(ctx: CanvasRenderingContext2D, params: TextEffectParams): TextLayout {
  ctx.font = buildFont(params);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const metrics = ctx.measureText(params.text || " ");
  const ascent = metrics.actualBoundingBoxAscent || params.fontSize * 0.75;
  const descent = metrics.actualBoundingBoxDescent || params.fontSize * 0.25;
  const textWidth = metrics.width;
  const textHeight = ascent + descent;

  return {
    x: (params.width - textWidth) / 2,
    y: params.height * 0.5 + (ascent - descent) / 2,
    width: textWidth,
    height: textHeight,
    ascent,
    descent,
  };
}

function buildDecodedText(params: TextEffectParams, progress: number): string {
  const text = params.text || " ";
  const chars = [...text];

  return chars
    .map((char, index) => {
      if (char === " ") {
        return " ";
      }

      const orderBias = chars.length <= 1 ? 0 : index / (chars.length - 1);
      const delay = 0.04 + orderBias * 0.28 + seededValue(params.seed, `delay-${index}`) * 0.42;
      const flickerFrames = 2 + Math.floor(seededValue(params.seed, `flicker-${index}`) * 3);
      const flickerWindow = flickerFrames / Math.max(1, params.fps * params.duration);
      const revealed = progress >= delay + flickerWindow;
      const nearReveal = progress >= delay && progress < delay + flickerWindow;

      if (revealed) {
        return char;
      }

      if (nearReveal) {
        const showReal = (params.frame + index) % 2 === 0;
        return showReal ? char : randomChar(params.seed, params.frame * 11 + index * 31);
      }

      return randomChar(params.seed, params.frame * 19 + index * 97);
    })
    .join("");
}

function randomChar(seed: number, salt: number): string {
  const rand = randomFromSeed((seed + salt * 2654435761) >>> 0);
  return CHAR_POOL[Math.floor(rand() * CHAR_POOL.length)] ?? "_";
}

function renderTextLayer(
  params: TextEffectParams,
  displayText: string,
  layout: TextLayout,
  progress: number,
): HTMLCanvasElement {
  const layer = document.createElement("canvas");
  layer.width = params.width;
  layer.height = params.height;
  const layerCtx = layer.getContext("2d", { alpha: true });

  if (!layerCtx) {
    throw new Error("Canvas 2D is not available for text layer rendering.");
  }

  layerCtx.clearRect(0, 0, params.width, params.height);
  layerCtx.font = buildFont(params);
  layerCtx.textAlign = "left";
  layerCtx.textBaseline = "alphabetic";

  const appear = smoothstep(0.02, 0.2, progress);
  const glow = clamp(params.glow);
  const pulse = 0.86 + Math.sin(progress * Math.PI * 8 + params.seed) * 0.14;

  layerCtx.save();
  layerCtx.globalAlpha = appear * (0.16 + glow * 0.22);
  layerCtx.shadowColor = params.color;
  layerCtx.shadowBlur = params.fontSize * (0.2 + glow * 0.55);
  layerCtx.fillStyle = params.color;
  layerCtx.fillText(displayText, layout.x, layout.y);
  layerCtx.restore();

  layerCtx.save();
  layerCtx.globalAlpha = appear * (0.4 + glow * 0.36) * pulse;
  layerCtx.shadowColor = params.color;
  layerCtx.shadowBlur = params.fontSize * (0.055 + glow * 0.12);
  layerCtx.fillStyle = params.color;
  layerCtx.fillText(displayText, layout.x, layout.y);
  layerCtx.restore();

  layerCtx.save();
  layerCtx.globalAlpha = appear;
  layerCtx.fillStyle = "#eaffff";
  layerCtx.fillText(displayText, layout.x, layout.y);
  layerCtx.globalCompositeOperation = "source-atop";
  const sheen = layerCtx.createLinearGradient(layout.x, layout.y - layout.ascent, layout.x, layout.y + layout.descent);
  sheen.addColorStop(0, "#ffffff");
  sheen.addColorStop(0.42, params.color);
  sheen.addColorStop(1, "#43a7ff");
  layerCtx.fillStyle = sheen;
  layerCtx.fillRect(layout.x - 8, layout.y - layout.ascent - 8, layout.width + 16, layout.height + 16);
  layerCtx.restore();

  layerCtx.save();
  layerCtx.globalAlpha = appear * 0.72;
  layerCtx.lineWidth = Math.max(1, params.fontSize * 0.018);
  layerCtx.strokeStyle = "rgba(255,255,255,0.72)";
  layerCtx.strokeText(displayText, layout.x, layout.y);
  layerCtx.restore();

  return layer;
}

function drawTextComposite(
  ctx: CanvasRenderingContext2D,
  layer: HTMLCanvasElement,
  params: TextEffectParams,
  glitch: ReturnType<typeof getGlitchState>,
): void {
  const split = params.fontSize * (0.012 + glitch.amount * 0.08) * clamp(params.intensity);

  if (split > 0.4) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.16 + glitch.amount * 0.38;
    ctx.filter = "none";
    ctx.drawImage(tintLayer(layer, "#ff235a"), -split, 0);
    ctx.drawImage(tintLayer(layer, "#1b7cff"), split, 0);
    ctx.restore();
  }

  ctx.drawImage(layer, 0, 0);

  if (glitch.amount <= 0.01) {
    return;
  }

  const rand = randomFromSeed((params.seed ^ (params.frame * 1103515245)) >>> 0);
  const slices = 3 + Math.floor(rand() * 6);
  const bandHeight = params.fontSize * (0.12 + rand() * 0.25);
  const centerY = params.height * (0.42 + rand() * 0.16);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < slices; i += 1) {
    const rawY = Math.round(centerY + (rand() - 0.5) * params.fontSize * 1.75);
    const rawH = Math.max(2, Math.round(bandHeight * (0.5 + rand())));
    const y = Math.max(0, Math.min(params.height - 1, rawY));
    const h = Math.max(1, Math.min(rawH, params.height - y));
    const offset = (rand() - 0.5) * params.fontSize * 0.42 * params.intensity * glitch.amount;
    ctx.globalAlpha = 0.55 + rand() * 0.35;
    ctx.drawImage(layer, 0, y, params.width, h, offset, y, params.width, h);
  }
  ctx.restore();
}

function tintLayer(source: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d", { alpha: true });

  if (!ctx) {
    throw new Error("Canvas 2D is not available for RGB split rendering.");
  }

  ctx.drawImage(source, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

function drawHud(
  ctx: CanvasRenderingContext2D,
  params: TextEffectParams,
  layout: TextLayout,
  progress: number,
  glitchAmount: number,
): void {
  const reveal = smoothstep(0.12, 0.46, progress);
  const flicker = 0.8 + seededValue(params.seed, `hud-${params.frame >> 1}`) * 0.2;
  const decoration = clamp(params.decoration);
  const alpha = reveal * flicker * decoration * (0.46 + glitchAmount * 0.24);
  const padX = params.fontSize * 0.22;
  const padY = params.fontSize * 0.24;
  const left = layout.x - padX;
  const right = layout.x + layout.width + padX;
  const top = layout.y - layout.ascent - padY;
  const bottom = layout.y + layout.descent + padY * 0.7;
  const corner = params.fontSize * 0.16;
  const tick = params.fontSize * 0.24;
  const square = Math.max(4, params.fontSize * 0.055);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = params.color;
  ctx.fillStyle = params.color;
  ctx.lineWidth = Math.max(1.5, params.fontSize * 0.018);
  ctx.shadowColor = params.color;
  ctx.shadowBlur = params.fontSize * (0.03 + params.glow * 0.08);

  drawCorner(ctx, left, top, corner, 1, 1);
  drawCorner(ctx, right, top, corner, -1, 1);
  drawCorner(ctx, left, bottom, corner, 1, -1);
  drawCorner(ctx, right, bottom, corner, -1, -1);

  ctx.beginPath();
  ctx.moveTo(left - tick * 1.15, layout.y - layout.ascent * 0.22);
  ctx.lineTo(left - tick * 0.25, layout.y - layout.ascent * 0.22);
  ctx.moveTo(right + tick * 0.25, layout.y - layout.ascent * 0.22);
  ctx.lineTo(right + tick * 1.15, layout.y - layout.ascent * 0.22);
  ctx.stroke();

  ctx.fillRect(left - tick * 1.42, layout.y + layout.descent * 0.22, square, square);
  ctx.fillRect(right + tick * 1.32, layout.y + layout.descent * 0.22, square, square);
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

function drawScanlines(
  ctx: CanvasRenderingContext2D,
  params: TextEffectParams,
  layout: TextLayout,
  progress: number,
): void {
  const scanline = clamp(params.scanline);
  if (scanline <= 0) {
    return;
  }

  const visible = smoothstep(0.04, 0.3, progress);
  const areaPad = params.fontSize * 0.75;
  const left = Math.max(0, layout.x - areaPad);
  const top = Math.max(0, layout.y - layout.ascent - areaPad);
  const width = Math.min(params.width - left, layout.width + areaPad * 2);
  const height = Math.min(params.height - top, layout.height + areaPad * 2);
  const spacing = Math.max(3, Math.round(params.fontSize * 0.085));
  const drift = (params.frame * 0.35) % spacing;

  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, width, height);
  ctx.clip();
  ctx.globalAlpha = visible * scanline * (params.background === "transparent" ? 0.16 : 0.22);
  ctx.strokeStyle = "#c9ffff";
  ctx.lineWidth = 1;

  for (let y = top - spacing + drift; y < top + height + spacing; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(left, Math.round(y) + 0.5);
    ctx.lineTo(left + width, Math.round(y) + 0.5);
    ctx.stroke();
  }

  ctx.restore();
}

function getGlitchState(params: TextEffectParams, progress: number): { amount: number } {
  const eventCount = 5;
  let amount = 0;

  for (let i = 0; i < eventCount; i += 1) {
    const base = (i + 0.75) / (eventCount + 0.8);
    const jitter = (seededValue(params.seed, `glitch-time-${i}`) - 0.5) * 0.08;
    const eventTime = clamp(base + jitter, 0.08, 0.92);
    const width = 0.018 + seededValue(params.seed, `glitch-width-${i}`) * 0.026;
    const distance = Math.abs(progress - eventTime);

    if (distance < width) {
      const local = 1 - distance / width;
      amount = Math.max(amount, Math.sin(local * Math.PI) * (0.45 + seededValue(params.seed, `glitch-amp-${i}`) * 0.55));
    }
  }

  const revealBurst = Math.sin(clamp(progress / 0.22) * Math.PI) * smoothstep(0, 0.18, progress) * (1 - smoothstep(0.22, 0.36, progress));
  return {
    amount: clamp((amount + revealBurst * 0.35) * clamp(params.intensity)),
  };
}

function buildFont(params: TextEffectParams): string {
  return `900 ${params.fontSize}px ${params.fontFamily}`;
}
