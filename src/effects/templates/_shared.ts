import type { TextEffectParams } from "../types";
import { clamp } from "../../utils/easing";

export interface TextLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  ascent: number;
  descent: number;
}

export function resetCanvas(ctx: CanvasRenderingContext2D, params: TextEffectParams): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.clearRect(0, 0, params.width, params.height);
}

export function drawTechBackground(ctx: CanvasRenderingContext2D, params: TextEffectParams, accent: string): void {
  if (params.background === "transparent") {
    return;
  }

  if (params.background === "black") {
    ctx.fillStyle = "#020305";
    ctx.fillRect(0, 0, params.width, params.height);
    return;
  }

  const radius = Math.max(params.width, params.height) * 0.68;
  const gradient = ctx.createRadialGradient(params.width * 0.5, params.height * 0.44, 0, params.width * 0.5, params.height * 0.5, radius);
  gradient.addColorStop(0, "rgba(16, 46, 70, 1)");
  gradient.addColorStop(0.5, "rgba(4, 15, 28, 1)");
  gradient.addColorStop(1, "rgba(1, 5, 12, 1)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, params.width, params.height);

  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1;
  const grid = Math.max(48, Math.round(params.fontSize * 0.42));
  for (let x = (params.frame * 0.18) % grid; x < params.width; x += grid) {
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, params.height);
    ctx.stroke();
  }
  for (let y = (params.frame * 0.12) % grid; y < params.height; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(params.width, Math.round(y) + 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

export function buildFont(params: TextEffectParams): string {
  return `${params.fontWeight} ${params.fontSize}px ${params.fontFamily}`;
}

export function measureTextLayout(ctx: CanvasRenderingContext2D, params: TextEffectParams): TextLayout {
  ctx.font = buildFont(params);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const metrics = ctx.measureText(params.text || " ");
  const ascent = metrics.actualBoundingBoxAscent || params.fontSize * 0.76;
  const descent = metrics.actualBoundingBoxDescent || params.fontSize * 0.24;
  const width = metrics.width;
  const height = ascent + descent;

  return {
    x: (params.width - width) / 2,
    y: params.height * 0.5 + (ascent - descent) / 2,
    width,
    height,
    ascent,
    descent,
  };
}

export function getProgress(params: TextEffectParams): number {
  const totalFrames = Math.max(1, Math.round(params.duration * params.fps));
  return clamp(params.frame / Math.max(1, totalFrames - 1));
}

export function customNumber(params: TextEffectParams, id: string, fallback: number): number {
  const value = params.custom[id];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function customString(params: TextEffectParams, id: string, fallback: string): string {
  const value = params.custom[id];
  return typeof value === "string" ? value : fallback;
}

export function customBoolean(params: TextEffectParams, id: string, fallback: boolean): boolean {
  const value = params.custom[id];
  return typeof value === "boolean" ? value : fallback;
}

export function drawCenteredText(
  ctx: CanvasRenderingContext2D,
  params: TextEffectParams,
  layout: TextLayout,
  color: string,
  alpha = 1,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = buildFont(params);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = color;
  ctx.fillText(params.text || " ", layout.x, layout.y);
  ctx.restore();
}

