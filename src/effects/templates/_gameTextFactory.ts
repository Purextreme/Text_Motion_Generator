import type { TextEffect, TextEffectControl, TextEffectParams } from "../types";
import { defineTextEffect } from "../types";
import { clamp, easeOutCubic, smoothstep } from "../../utils/easing";
import { randomFromSeed, seededValue } from "../../utils/seededRandom";
import { buildFont, customNumber, customString, drawTechBackground, getProgress, measureTextLayout, resetCanvas, type TextLayout } from "./_shared";

type GameLayerSet =
  | "lockon"
  | "slicer"
  | "portal"
  | "plasma"
  | "waterfall"
  | "mecha"
  | "reactor"
  | "orbital"
  | "boss"
  | "blueprint";

interface GameTextEffectConfig {
  id: string;
  name: string;
  description: string;
  layerSet: GameLayerSet;
  palette: {
    accent: string;
    secondary: string;
    danger: string;
    fill?: string;
  };
  controls: TextEffectControl[];
  powerId: string;
  detailId: string;
  chaosId: string;
  accentId: string;
}

interface RenderSettings {
  progress: number;
  reveal: number;
  power: number;
  detail: number;
  chaos: number;
  accent: string;
  secondary: string;
  danger: string;
}

const CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789零一二三四五六七八九甲乙丙丁子丑寅卯芯片算力影像刷新频率#<>[]{}+-*/_";

export function createGameTextEffect(config: GameTextEffectConfig): TextEffect {
  return defineTextEffect({
    id: config.id,
    name: config.name,
    version: "1.0.0",
    description: config.description,
    controls: config.controls,
    render(ctx, params) {
      resetCanvas(ctx, params);
      const progress = getProgress(params);
      const settings = getSettings(config, params, progress);
      drawTechBackground(ctx, params, settings.accent);

      const layout = measureTextLayout(ctx, params);
      drawAmbientNoise(ctx, params, settings);
      renderLayerSet(config.layerSet, ctx, params, layout, settings, config);
      drawCinematicHudOverlay(ctx, params, layout, settings, config);
      drawTextComposite(ctx, params, layout, settings, config);
      drawForegroundInterference(ctx, params, layout, settings);
    },
  });
}

function getSettings(config: GameTextEffectConfig, params: TextEffectParams, progress: number): RenderSettings {
  const power = customNumber(params, config.powerId, 0.75);
  const detail = customNumber(params, config.detailId, 0.7);
  const chaos = customNumber(params, config.chaosId, 0.55);
  const accent = customString(params, config.accentId, config.palette.accent);

  return {
    progress,
    reveal: smoothstep(0.06, 0.58, progress),
    power,
    detail,
    chaos,
    accent,
    secondary: config.palette.secondary,
    danger: config.palette.danger,
  };
}

function renderLayerSet(
  layerSet: GameLayerSet,
  ctx: CanvasRenderingContext2D,
  params: TextEffectParams,
  layout: TextLayout,
  settings: RenderSettings,
  config: GameTextEffectConfig,
): void {
  switch (layerSet) {
    case "lockon":
      drawRadar(ctx, params, layout, settings);
      drawReticle(ctx, params, layout, settings, true);
      drawChargeBars(ctx, params, layout, settings);
      break;
    case "slicer":
      drawVhsBands(ctx, params, settings);
      drawSlidingSlices(ctx, params, layout, settings, config);
      drawGlassCracks(ctx, params, layout, settings);
      break;
    case "portal":
      drawPortalRings(ctx, params, layout, settings);
      drawParticleField(ctx, params, layout, settings, "inward");
      drawLensFlares(ctx, params, layout, settings);
      break;
    case "plasma":
      drawPlasmaCore(ctx, params, layout, settings);
      drawEnergyArcs(ctx, params, layout, settings);
      drawParticleField(ctx, params, layout, settings, "burst");
      break;
    case "waterfall":
      drawCodeWaterfall(ctx, params, layout, settings);
      drawLiquidMask(ctx, params, layout, settings);
      break;
    case "mecha":
      drawMechanicalPanels(ctx, params, layout, settings);
      drawAssemblyBolts(ctx, params, layout, settings);
      drawReticle(ctx, params, layout, settings, false);
      break;
    case "reactor":
      drawReactorGrid(ctx, params, layout, settings);
      drawShockwaves(ctx, params, layout, settings);
      drawParticleField(ctx, params, layout, settings, "orbit");
      break;
    case "orbital":
      drawOrbitalTracks(ctx, params, layout, settings);
      drawSatelliteTicks(ctx, params, layout, settings);
      drawParticleField(ctx, params, layout, settings, "orbit");
      break;
    case "boss":
      drawBossWarning(ctx, params, layout, settings);
      drawDamageNumbers(ctx, params, layout, settings);
      drawVhsBands(ctx, params, settings);
      break;
    case "blueprint":
      drawBlueprintGrid(ctx, params, settings);
      drawScannerFrame(ctx, params, layout, settings);
      drawMeasurementCallouts(ctx, params, layout, settings);
      break;
  }
}

function drawTextComposite(
  ctx: CanvasRenderingContext2D,
  params: TextEffectParams,
  layout: TextLayout,
  settings: RenderSettings,
  config: GameTextEffectConfig,
): void {
  const layer = createTextLayer(params, layout, settings, config);
  const glitch = getGlitchAmount(params, settings);
  const rgbShift = params.fontSize * (0.012 + settings.chaos * 0.055) * glitch;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.24 + settings.power * 0.28;
  ctx.drawImage(tintLayer(layer, settings.danger), -rgbShift, rgbShift * 0.18);
  ctx.drawImage(tintLayer(layer, settings.secondary), rgbShift, -rgbShift * 0.12);
  ctx.restore();

  ctx.drawImage(layer, 0, 0);

  if (glitch > 0.05) {
    drawGlitchSlices(ctx, params, layer, layout, settings, glitch);
  }

  drawTextScanSheen(ctx, params, layout, settings);
}

function createTextLayer(
  params: TextEffectParams,
  layout: TextLayout,
  settings: RenderSettings,
  config: GameTextEffectConfig,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = params.width;
  canvas.height = params.height;
  const ctx = canvas.getContext("2d", { alpha: true });

  if (!ctx) {
    throw new Error("Canvas 2D is not available.");
  }

  const text = params.text || " ";
  const reveal = easeOutCubic(settings.reveal);
  const verticalLift = (1 - reveal) * params.fontSize * 0.16;

  ctx.font = buildFont(params);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.globalAlpha = reveal;
  ctx.shadowColor = settings.accent;
  ctx.shadowBlur = params.fontSize * (0.1 + settings.power * 0.22);

  const gradient = ctx.createLinearGradient(layout.x, layout.y - layout.ascent, layout.x + layout.width, layout.y + layout.descent);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.28, config.palette.fill ?? params.color);
  gradient.addColorStop(0.58, settings.accent);
  gradient.addColorStop(0.82, "#e8fdff");
  gradient.addColorStop(1, settings.secondary);
  ctx.fillStyle = gradient;
  ctx.fillText(text, layout.x, layout.y + verticalLift);

  ctx.globalAlpha = reveal * (0.42 + settings.power * 0.38);
  ctx.lineWidth = Math.max(1, params.fontSize * 0.015);
  ctx.strokeStyle = "rgba(255,255,255,0.86)";
  ctx.strokeText(text, layout.x, layout.y + verticalLift);

  return canvas;
}

function drawAmbientNoise(ctx: CanvasRenderingContext2D, params: TextEffectParams, settings: RenderSettings): void {
  const count = Math.round(40 + settings.detail * 90);
  const rand = randomFromSeed((params.seed ^ (params.frame * 977)) >>> 0);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = settings.accent;
  for (let i = 0; i < count; i += 1) {
    const x = rand() * params.width;
    const y = rand() * params.height;
    const alpha = rand() * 0.08 * settings.detail;
    ctx.globalAlpha = alpha;
    ctx.fillRect(x, y, 1 + rand() * 2, 1 + rand() * 2);
  }
  ctx.restore();
}

function drawCinematicHudOverlay(
  ctx: CanvasRenderingContext2D,
  params: TextEffectParams,
  layout: TextLayout,
  settings: RenderSettings,
  config: GameTextEffectConfig,
): void {
  const reveal = easeOutCubic(smoothstep(0.14, 0.72, settings.progress));
  const centerX = params.width * 0.5;
  const railWidth = Math.min(params.width * 0.82, layout.width + params.fontSize * (4.2 + settings.detail * 3.2));
  const left = centerX - railWidth * 0.5;
  const right = centerX + railWidth * 0.5;
  const top = layout.y - layout.ascent - params.fontSize * (0.72 + settings.detail * 0.24);
  const bottom = layout.y + layout.descent + params.fontSize * (0.62 + settings.detail * 0.24);
  const railProgress = railWidth * reveal;
  const railHeight = Math.max(3, params.fontSize * 0.025);
  const labelSize = Math.max(12, params.fontSize * 0.105);
  const flicker = 0.82 + seededValue(params.seed, `${config.id}-overlay-${params.frame >> 1}`) * 0.18;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = settings.detail * flicker;
  ctx.strokeStyle = settings.accent;
  ctx.fillStyle = settings.accent;
  ctx.lineWidth = Math.max(1, params.fontSize * 0.012);
  ctx.shadowColor = settings.accent;
  ctx.shadowBlur = params.fontSize * (0.06 + settings.power * 0.08);

  ctx.fillRect(left, top, railProgress * 0.34, railHeight);
  ctx.fillRect(right - railProgress * 0.34, top, railProgress * 0.34, railHeight);
  ctx.fillRect(left, bottom, railProgress * 0.44, railHeight);
  ctx.fillRect(right - railProgress * 0.44, bottom, railProgress * 0.44, railHeight);

  const tickCount = 9 + Math.round(settings.detail * 10);
  for (let i = 0; i <= tickCount; i += 1) {
    const t = tickCount === 0 ? 0 : i / tickCount;
    if (t > reveal) {
      continue;
    }
    const x = left + railWidth * t;
    const h = params.fontSize * (0.07 + (i % 3) * 0.035);
    ctx.globalAlpha = settings.detail * (0.22 + (i % 4) * 0.08);
    ctx.fillRect(x, top - h * 1.35, Math.max(2, params.fontSize * 0.012), h);
    ctx.fillRect(x, bottom + h * 0.35, Math.max(2, params.fontSize * 0.012), h);
  }

  ctx.globalAlpha = settings.detail * reveal * 0.68;
  drawWideBracket(ctx, left, top, bottom, params.fontSize * 0.42, 1);
  drawWideBracket(ctx, right, top, bottom, params.fontSize * 0.42, -1);

  ctx.font = `800 ${labelSize}px ${params.fontFamily}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(config.id.toUpperCase().slice(0, 22), left, top - params.fontSize * 0.32);
  ctx.textAlign = "right";
  ctx.fillText(`SYNC ${String(Math.round(settings.reveal * 100)).padStart(3, "0")}%`, right, bottom + params.fontSize * 0.34);

  ctx.globalAlpha = settings.detail * settings.chaos * 0.24;
  ctx.strokeStyle = settings.danger;
  ctx.beginPath();
  ctx.moveTo(left - params.fontSize * 0.18, layout.y);
  ctx.lineTo(right + params.fontSize * 0.18, layout.y);
  ctx.stroke();

  ctx.restore();
}

function drawWideBracket(
  ctx: CanvasRenderingContext2D,
  x: number,
  top: number,
  bottom: number,
  size: number,
  direction: 1 | -1,
): void {
  ctx.beginPath();
  ctx.moveTo(x, top + size);
  ctx.lineTo(x, top);
  ctx.lineTo(x + direction * size, top);
  ctx.moveTo(x, bottom - size);
  ctx.lineTo(x, bottom);
  ctx.lineTo(x + direction * size, bottom);
  ctx.stroke();
}

function drawRadar(ctx: CanvasRenderingContext2D, params: TextEffectParams, layout: TextLayout, settings: RenderSettings): void {
  const radius = Math.max(layout.width, params.fontSize * 3) * (0.45 + settings.detail * 0.24);
  const cx = params.width * 0.5;
  const cy = layout.y - layout.ascent * 0.18;
  const angle = settings.progress * Math.PI * 2.8;

  ctx.save();
  ctx.globalAlpha = settings.detail * 0.52;
  ctx.strokeStyle = settings.accent;
  ctx.lineWidth = Math.max(1, params.fontSize * 0.01);
  ctx.shadowColor = settings.accent;
  ctx.shadowBlur = params.fontSize * 0.08;
  for (let i = 1; i <= 4; i += 1) {
    ctx.beginPath();
    ctx.arc(cx, cy, (radius * i) / 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  ctx.stroke();
  ctx.restore();
}

function drawReticle(
  ctx: CanvasRenderingContext2D,
  params: TextEffectParams,
  layout: TextLayout,
  settings: RenderSettings,
  aggressive: boolean,
): void {
  const lock = easeOutCubic(smoothstep(0.1, 0.64, settings.progress));
  const padX = params.fontSize * (aggressive ? 0.54 : 0.36) + (1 - lock) * params.width * 0.18;
  const padY = params.fontSize * (aggressive ? 0.42 : 0.28) + (1 - lock) * params.height * 0.12;
  const left = layout.x - padX;
  const right = layout.x + layout.width + padX;
  const top = layout.y - layout.ascent - padY;
  const bottom = layout.y + layout.descent + padY;
  const tick = params.fontSize * (aggressive ? 0.34 : 0.24);

  ctx.save();
  ctx.globalAlpha = settings.detail * lock;
  ctx.strokeStyle = aggressive ? settings.danger : settings.accent;
  ctx.fillStyle = settings.accent;
  ctx.lineWidth = Math.max(1.5, params.fontSize * 0.017);
  ctx.shadowColor = aggressive ? settings.danger : settings.accent;
  ctx.shadowBlur = params.fontSize * 0.12;
  drawCorners(ctx, left, top, right, bottom, tick);
  ctx.fillRect(left - tick * 0.8, (top + bottom) / 2, tick * 0.42, Math.max(2, params.fontSize * 0.035));
  ctx.fillRect(right + tick * 0.38, (top + bottom) / 2, tick * 0.42, Math.max(2, params.fontSize * 0.035));
  ctx.restore();
}

function drawCorners(ctx: CanvasRenderingContext2D, left: number, top: number, right: number, bottom: number, tick: number): void {
  ctx.beginPath();
  ctx.moveTo(left, top + tick);
  ctx.lineTo(left, top);
  ctx.lineTo(left + tick, top);
  ctx.moveTo(right - tick, top);
  ctx.lineTo(right, top);
  ctx.lineTo(right, top + tick);
  ctx.moveTo(left, bottom - tick);
  ctx.lineTo(left, bottom);
  ctx.lineTo(left + tick, bottom);
  ctx.moveTo(right - tick, bottom);
  ctx.lineTo(right, bottom);
  ctx.lineTo(right, bottom - tick);
  ctx.stroke();
}

function drawChargeBars(ctx: CanvasRenderingContext2D, params: TextEffectParams, layout: TextLayout, settings: RenderSettings): void {
  const count = Math.round(8 + settings.detail * 12);
  const reveal = smoothstep(0.22, 0.82, settings.progress);
  const y = layout.y + layout.descent + params.fontSize * 0.46;
  const barW = layout.width / count;

  ctx.save();
  ctx.fillStyle = settings.accent;
  ctx.shadowColor = settings.accent;
  ctx.shadowBlur = params.fontSize * 0.06;
  for (let i = 0; i < count; i += 1) {
    if (i / count > reveal) {
      continue;
    }
    ctx.globalAlpha = 0.25 + (i / count) * 0.55;
    ctx.fillRect(layout.x + i * barW, y, barW * 0.58, Math.max(3, params.fontSize * 0.035));
  }
  ctx.restore();
}

function drawVhsBands(ctx: CanvasRenderingContext2D, params: TextEffectParams, settings: RenderSettings): void {
  const bands = Math.round(7 + settings.chaos * 9);
  const rand = randomFromSeed((params.seed + params.frame * 131) >>> 0);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < bands; i += 1) {
    const y = rand() * params.height;
    const h = 2 + rand() * params.fontSize * 0.08;
    ctx.globalAlpha = rand() * 0.12 * settings.chaos;
    ctx.fillStyle = rand() > 0.5 ? settings.accent : settings.danger;
    ctx.fillRect(0, y, params.width, h);
  }
  ctx.restore();
}

function drawSlidingSlices(
  ctx: CanvasRenderingContext2D,
  params: TextEffectParams,
  layout: TextLayout,
  settings: RenderSettings,
  config: GameTextEffectConfig,
): void {
  const slices = Math.round(5 + settings.detail * 7);
  const textLayer = createTextLayer(params, layout, { ...settings, reveal: smoothstep(0.01, 0.24, settings.progress) }, config);
  const top = layout.y - layout.ascent - params.fontSize * 0.28;
  const height = (layout.height + params.fontSize * 0.56) / slices;
  const assemble = easeOutCubic(smoothstep(0.08, 0.58, settings.progress));

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < slices; i += 1) {
    const y = top + i * height;
    const side = i % 2 === 0 ? -1 : 1;
    const offset = side * (1 - assemble) * params.width * (0.28 + settings.chaos * 0.18);
    ctx.globalAlpha = 0.22 + settings.power * 0.42;
    ctx.drawImage(textLayer, 0, y, params.width, height + 2, offset, y, params.width, height + 2);
  }
  ctx.restore();
}

function drawGlassCracks(ctx: CanvasRenderingContext2D, params: TextEffectParams, layout: TextLayout, settings: RenderSettings): void {
  const alpha = smoothstep(0.48, 0.9, settings.progress) * settings.chaos;
  const rand = randomFromSeed(params.seed ^ 0x9e3779b9);
  const cx = params.width * 0.5;
  const cy = layout.y - layout.ascent * 0.24;

  ctx.save();
  ctx.globalAlpha = alpha * 0.35;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  for (let i = 0; i < 14; i += 1) {
    const angle = rand() * Math.PI * 2;
    const len = params.fontSize * (0.25 + rand() * 1.1);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * params.fontSize * 0.08, cy + Math.sin(angle) * params.fontSize * 0.08);
    ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPortalRings(ctx: CanvasRenderingContext2D, params: TextEffectParams, layout: TextLayout, settings: RenderSettings): void {
  const cx = params.width * 0.5;
  const cy = layout.y - layout.ascent * 0.15;
  const base = Math.max(layout.width, params.fontSize * 3) * 0.52;
  const reveal = smoothstep(0.02, 0.52, settings.progress);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = settings.accent;
  ctx.shadowColor = settings.accent;
  ctx.shadowBlur = params.fontSize * 0.16;
  for (let i = 0; i < 5; i += 1) {
    ctx.globalAlpha = reveal * (0.16 + settings.detail * 0.16);
    ctx.lineWidth = Math.max(1, params.fontSize * (0.008 + i * 0.003));
    ctx.beginPath();
    const radiusX = base * (0.42 + i * 0.14);
    const radiusY = radiusX * (0.34 + i * 0.025);
    ctx.ellipse(cx, cy, radiusX, radiusY, settings.progress * (i % 2 ? -1 : 1) * 2, Math.PI * 0.08 * i, Math.PI * 2 - Math.PI * 0.16 * i);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticleField(
  ctx: CanvasRenderingContext2D,
  params: TextEffectParams,
  layout: TextLayout,
  settings: RenderSettings,
  mode: "inward" | "burst" | "orbit",
): void {
  const count = Math.round(70 + settings.detail * 150);
  const rand = randomFromSeed(params.seed ^ 0xabcddcba);
  const cx = params.width * 0.5;
  const cy = layout.y - layout.ascent * 0.18;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = settings.accent;
  ctx.shadowColor = settings.accent;
  ctx.shadowBlur = params.fontSize * 0.05;
  for (let i = 0; i < count; i += 1) {
    const a = rand() * Math.PI * 2;
    const r = params.fontSize * (0.4 + rand() * (2.7 + settings.power));
    const phase = (settings.progress + rand()) % 1;
    const factor = mode === "inward" ? 1 - easeOutCubic(phase) : mode === "burst" ? easeOutCubic(phase) : 0.65 + Math.sin(settings.progress * Math.PI * 2 + i) * 0.18;
    const x = cx + Math.cos(a + settings.progress * (mode === "orbit" ? 2.6 : 0.4)) * r * factor;
    const y = cy + Math.sin(a + settings.progress * (mode === "orbit" ? 2.6 : 0.4)) * r * factor * 0.48;
    ctx.globalAlpha = 0.1 + rand() * 0.42;
    ctx.fillRect(x, y, 1.5 + rand() * 3, 1.5 + rand() * 3);
  }
  ctx.restore();
}

function drawLensFlares(ctx: CanvasRenderingContext2D, params: TextEffectParams, layout: TextLayout, settings: RenderSettings): void {
  const x = layout.x + layout.width * smoothstep(0.18, 0.88, settings.progress);
  const y = layout.y - layout.ascent * 0.78;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, params.fontSize * (0.2 + settings.power * 0.65));
  gradient.addColorStop(0, "rgba(255,255,255,0.92)");
  gradient.addColorStop(0.24, settings.accent);
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.globalAlpha = settings.power * 0.48;
  ctx.fillStyle = gradient;
  ctx.fillRect(x - params.fontSize, y - params.fontSize, params.fontSize * 2, params.fontSize * 2);
  ctx.restore();
}

function drawPlasmaCore(ctx: CanvasRenderingContext2D, params: TextEffectParams, layout: TextLayout, settings: RenderSettings): void {
  const cx = params.width * 0.5;
  const cy = layout.y - layout.ascent * 0.18;
  const radius = Math.max(layout.width * 0.42, params.fontSize * 1.2);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, "rgba(255,255,255,0.38)");
  gradient.addColorStop(0.28, settings.accent);
  gradient.addColorStop(0.56, settings.secondary);
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.globalAlpha = settings.power * smoothstep(0.03, 0.46, settings.progress) * 0.28;
  ctx.fillStyle = gradient;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.restore();
}

function drawEnergyArcs(ctx: CanvasRenderingContext2D, params: TextEffectParams, layout: TextLayout, settings: RenderSettings): void {
  const rand = randomFromSeed((params.seed + (params.frame >> 1) * 17) >>> 0);
  const cx = params.width * 0.5;
  const cy = layout.y - layout.ascent * 0.18;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = settings.accent;
  ctx.shadowColor = settings.accent;
  ctx.shadowBlur = params.fontSize * 0.16;
  ctx.lineWidth = Math.max(1, params.fontSize * 0.014);
  for (let i = 0; i < 9 + settings.detail * 12; i += 1) {
    const a = rand() * Math.PI * 2;
    const len = params.fontSize * (0.38 + rand() * 1.7);
    ctx.globalAlpha = rand() * settings.power * 0.45;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * len * 0.25, cy + Math.sin(a) * len * 0.12);
    ctx.lineTo(cx + Math.cos(a + rand() * 0.8) * len, cy + Math.sin(a + rand() * 0.8) * len * 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCodeWaterfall(ctx: CanvasRenderingContext2D, params: TextEffectParams, layout: TextLayout, settings: RenderSettings): void {
  const columns = Math.round(layout.width / Math.max(12, params.fontSize * 0.16));
  const fontSize = Math.max(12, params.fontSize * 0.15);
  const top = layout.y - layout.ascent - params.fontSize * 1.2;

  ctx.save();
  ctx.font = `500 ${fontSize}px ${params.fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = settings.accent;
  ctx.shadowColor = settings.accent;
  ctx.shadowBlur = params.fontSize * 0.04;
  for (let xIndex = 0; xIndex < columns; xIndex += 1) {
    const x = layout.x + (xIndex / Math.max(1, columns - 1)) * layout.width;
    for (let yIndex = 0; yIndex < 8; yIndex += 1) {
      const y = top + ((yIndex * fontSize * 1.6 + params.frame * (1.4 + settings.power * 2)) % (layout.height + params.fontSize * 2.4));
      const char = CODE_CHARS[Math.floor(seededValue(params.seed + params.frame, `code-${xIndex}-${yIndex}`) * CODE_CHARS.length)] ?? "0";
      ctx.globalAlpha = settings.detail * (0.08 + yIndex * 0.035);
      ctx.fillText(char, x, y);
    }
  }
  ctx.restore();
}

function drawLiquidMask(ctx: CanvasRenderingContext2D, params: TextEffectParams, layout: TextLayout, settings: RenderSettings): void {
  const wave = Math.sin(settings.progress * Math.PI * 3) * params.fontSize * 0.05;
  const y = layout.y + layout.descent + wave;

  ctx.save();
  ctx.globalAlpha = settings.power * 0.4;
  ctx.strokeStyle = settings.accent;
  ctx.lineWidth = Math.max(1, params.fontSize * 0.012);
  ctx.beginPath();
  ctx.moveTo(layout.x, y);
  for (let i = 0; i <= 18; i += 1) {
    const x = layout.x + (layout.width * i) / 18;
    ctx.lineTo(x, y + Math.sin(i * 1.7 + settings.progress * Math.PI * 8) * params.fontSize * 0.045);
  }
  ctx.stroke();
  ctx.restore();
}

function drawMechanicalPanels(ctx: CanvasRenderingContext2D, params: TextEffectParams, layout: TextLayout, settings: RenderSettings): void {
  const reveal = smoothstep(0.08, 0.64, settings.progress);
  const pad = params.fontSize * 0.56;
  const left = layout.x - pad;
  const right = layout.x + layout.width + pad;
  const top = layout.y - layout.ascent - pad * 0.7;
  const bottom = layout.y + layout.descent + pad * 0.55;

  ctx.save();
  ctx.globalAlpha = settings.detail * 0.54;
  ctx.strokeStyle = settings.accent;
  ctx.fillStyle = "rgba(255,255,255,0.035)";
  ctx.lineWidth = Math.max(1, params.fontSize * 0.012);
  ctx.fillRect(left, top, (right - left) * reveal, bottom - top);
  ctx.strokeRect(left, top, right - left, bottom - top);
  for (let i = 0; i < 6; i += 1) {
    const x = left + (right - left) * (i / 5);
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + params.fontSize * 0.18, bottom);
    ctx.stroke();
  }
  ctx.restore();
}

function drawAssemblyBolts(ctx: CanvasRenderingContext2D, params: TextEffectParams, layout: TextLayout, settings: RenderSettings): void {
  const alpha = smoothstep(0.28, 0.78, settings.progress) * settings.detail;
  const points = [
    [layout.x - params.fontSize * 0.44, layout.y - layout.ascent - params.fontSize * 0.36],
    [layout.x + layout.width + params.fontSize * 0.44, layout.y - layout.ascent - params.fontSize * 0.36],
    [layout.x - params.fontSize * 0.44, layout.y + layout.descent + params.fontSize * 0.3],
    [layout.x + layout.width + params.fontSize * 0.44, layout.y + layout.descent + params.fontSize * 0.3],
  ];

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = settings.accent;
  ctx.fillStyle = settings.accent;
  for (const [x, y] of points) {
    ctx.beginPath();
    ctx.arc(x, y, params.fontSize * 0.045, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillRect(x - 1, y - params.fontSize * 0.09, 2, params.fontSize * 0.18);
  }
  ctx.restore();
}

function drawReactorGrid(ctx: CanvasRenderingContext2D, params: TextEffectParams, layout: TextLayout, settings: RenderSettings): void {
  const cx = params.width * 0.5;
  const cy = layout.y - layout.ascent * 0.18;
  const size = Math.max(layout.width, params.fontSize * 3) * 0.72;
  const reveal = smoothstep(0.02, 0.5, settings.progress);

  ctx.save();
  ctx.globalAlpha = reveal * settings.detail * 0.38;
  ctx.strokeStyle = settings.accent;
  ctx.lineWidth = 1;
  for (let i = -4; i <= 4; i += 1) {
    ctx.beginPath();
    ctx.moveTo(cx - size, cy + i * params.fontSize * 0.18);
    ctx.lineTo(cx + size, cy + i * params.fontSize * 0.18);
    ctx.moveTo(cx + i * params.fontSize * 0.32, cy - size * 0.34);
    ctx.lineTo(cx + i * params.fontSize * 0.32, cy + size * 0.34);
    ctx.stroke();
  }
  ctx.restore();
}

function drawShockwaves(ctx: CanvasRenderingContext2D, params: TextEffectParams, layout: TextLayout, settings: RenderSettings): void {
  const cx = params.width * 0.5;
  const cy = layout.y - layout.ascent * 0.18;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = settings.accent;
  ctx.lineWidth = Math.max(1, params.fontSize * 0.012);
  for (let i = 0; i < 4; i += 1) {
    const phase = (settings.progress * 1.3 + i * 0.22) % 1;
    const r = params.fontSize * (0.4 + phase * 3.2);
    ctx.globalAlpha = (1 - phase) * settings.power * 0.34;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawOrbitalTracks(ctx: CanvasRenderingContext2D, params: TextEffectParams, layout: TextLayout, settings: RenderSettings): void {
  drawPortalRings(ctx, params, layout, { ...settings, detail: Math.min(1, settings.detail + 0.2) });
  const cx = params.width * 0.5;
  const cy = layout.y - layout.ascent * 0.18;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = settings.accent;
  for (let i = 0; i < 5; i += 1) {
    const a = settings.progress * Math.PI * (1.2 + i * 0.22) + i;
    const rx = Math.max(layout.width, params.fontSize * 3) * (0.28 + i * 0.08);
    const ry = rx * 0.36;
    ctx.globalAlpha = 0.4 + i * 0.06;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, params.fontSize * 0.026, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSatelliteTicks(ctx: CanvasRenderingContext2D, params: TextEffectParams, layout: TextLayout, settings: RenderSettings): void {
  const cx = params.width * 0.5;
  const cy = layout.y - layout.ascent * 0.18;
  const radius = Math.max(layout.width, params.fontSize * 3) * 0.55;

  ctx.save();
  ctx.strokeStyle = settings.secondary;
  ctx.globalAlpha = settings.detail * 0.58;
  for (let i = 0; i < 24; i += 1) {
    const a = (i / 24) * Math.PI * 2 + settings.progress * 0.7;
    const inner = radius * (0.92 + (i % 3) * 0.04);
    const outer = inner + params.fontSize * 0.08;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner * 0.45);
    ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer * 0.45);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBossWarning(ctx: CanvasRenderingContext2D, params: TextEffectParams, layout: TextLayout, settings: RenderSettings): void {
  const flash = 0.65 + Math.sin(settings.progress * Math.PI * 14) * 0.35;
  const yTop = layout.y - layout.ascent - params.fontSize * 0.48;
  const yBottom = layout.y + layout.descent + params.fontSize * 0.46;

  ctx.save();
  ctx.globalAlpha = smoothstep(0.04, 0.34, settings.progress) * flash;
  ctx.fillStyle = settings.danger;
  ctx.shadowColor = settings.danger;
  ctx.shadowBlur = params.fontSize * 0.12;
  ctx.fillRect(layout.x - params.fontSize * 0.4, yTop, layout.width + params.fontSize * 0.8, Math.max(4, params.fontSize * 0.04));
  ctx.fillRect(layout.x - params.fontSize * 0.4, yBottom, layout.width + params.fontSize * 0.8, Math.max(4, params.fontSize * 0.04));
  ctx.restore();
}

function drawDamageNumbers(ctx: CanvasRenderingContext2D, params: TextEffectParams, layout: TextLayout, settings: RenderSettings): void {
  const count = Math.round(4 + settings.detail * 8);
  const rand = randomFromSeed(params.seed ^ 0x544545);

  ctx.save();
  ctx.font = `800 ${Math.max(12, params.fontSize * 0.12)}px ${params.fontFamily}`;
  ctx.fillStyle = settings.danger;
  ctx.globalAlpha = smoothstep(0.2, 0.8, settings.progress) * 0.65;
  for (let i = 0; i < count; i += 1) {
    const x = layout.x + rand() * layout.width;
    const y = layout.y - layout.ascent - params.fontSize * (0.35 + rand() * 0.9) - settings.progress * params.fontSize * 0.4;
    ctx.fillText(`-${Math.round(10 + rand() * 990)}`, x, y);
  }
  ctx.restore();
}

function drawBlueprintGrid(ctx: CanvasRenderingContext2D, params: TextEffectParams, settings: RenderSettings): void {
  const gap = Math.max(28, params.fontSize * 0.26);
  ctx.save();
  ctx.globalAlpha = settings.detail * 0.22;
  ctx.strokeStyle = settings.accent;
  ctx.lineWidth = 1;
  for (let x = (params.frame * 0.2) % gap; x < params.width; x += gap) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, params.height);
    ctx.stroke();
  }
  for (let y = (params.frame * 0.14) % gap; y < params.height; y += gap) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(params.width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawScannerFrame(ctx: CanvasRenderingContext2D, params: TextEffectParams, layout: TextLayout, settings: RenderSettings): void {
  drawReticle(ctx, params, layout, settings, false);
  const sweep = layout.x - params.fontSize + (layout.width + params.fontSize * 2) * settings.progress;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const gradient = ctx.createLinearGradient(sweep - params.fontSize * 0.3, 0, sweep + params.fontSize * 0.3, 0);
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(0.5, settings.accent);
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.globalAlpha = settings.power * 0.44;
  ctx.fillStyle = gradient;
  ctx.fillRect(sweep - params.fontSize * 0.3, layout.y - layout.ascent - params.fontSize * 0.7, params.fontSize * 0.6, layout.height + params.fontSize * 1.2);
  ctx.restore();
}

function drawMeasurementCallouts(ctx: CanvasRenderingContext2D, params: TextEffectParams, layout: TextLayout, settings: RenderSettings): void {
  const labels = ["WIDTH", "SIGNAL", "VECTOR", "SYNC"];
  ctx.save();
  ctx.globalAlpha = smoothstep(0.36, 0.9, settings.progress) * settings.detail;
  ctx.font = `700 ${Math.max(12, params.fontSize * 0.1)}px ${params.fontFamily}`;
  ctx.fillStyle = settings.accent;
  ctx.strokeStyle = settings.accent;
  labels.forEach((label, index) => {
    const x = index % 2 === 0 ? layout.x - params.fontSize * 1.1 : layout.x + layout.width + params.fontSize * 0.52;
    const y = layout.y - layout.ascent * (0.8 - index * 0.22);
    ctx.fillText(label, x, y);
    ctx.beginPath();
    ctx.moveTo(x + (index % 2 === 0 ? params.fontSize * 0.5 : -params.fontSize * 0.18), y + 4);
    ctx.lineTo(index % 2 === 0 ? layout.x : layout.x + layout.width, y + 4);
    ctx.stroke();
  });
  ctx.restore();
}

function drawForegroundInterference(ctx: CanvasRenderingContext2D, params: TextEffectParams, layout: TextLayout, settings: RenderSettings): void {
  const scanlineAlpha = settings.detail * 0.08;
  if (scanlineAlpha <= 0) {
    return;
  }

  const spacing = Math.max(3, Math.round(params.fontSize * 0.08));
  const drift = (params.frame * (0.28 + settings.power * 0.35)) % spacing;
  ctx.save();
  ctx.beginPath();
  ctx.rect(layout.x - params.fontSize, layout.y - layout.ascent - params.fontSize, layout.width + params.fontSize * 2, layout.height + params.fontSize * 2);
  ctx.clip();
  ctx.globalAlpha = scanlineAlpha;
  ctx.strokeStyle = "#ffffff";
  for (let y = layout.y - layout.ascent - params.fontSize + drift; y < layout.y + params.fontSize; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(layout.x - params.fontSize, Math.round(y) + 0.5);
    ctx.lineTo(layout.x + layout.width + params.fontSize, Math.round(y) + 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTextScanSheen(ctx: CanvasRenderingContext2D, params: TextEffectParams, layout: TextLayout, settings: RenderSettings): void {
  const x = layout.x - params.fontSize + (layout.width + params.fontSize * 2) * ((settings.progress * 1.35) % 1);
  const width = params.fontSize * (0.22 + settings.power * 0.34);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.beginPath();
  ctx.rect(layout.x - 12, layout.y - layout.ascent - 20, layout.width + 24, layout.height + 40);
  ctx.clip();
  const gradient = ctx.createLinearGradient(x - width, 0, x + width, 0);
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(0.5, settings.accent);
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.globalAlpha = settings.power * 0.28;
  ctx.fillStyle = gradient;
  ctx.fillRect(x - width, layout.y - layout.ascent - 24, width * 2, layout.height + 48);
  ctx.restore();
}

function drawGlitchSlices(
  ctx: CanvasRenderingContext2D,
  params: TextEffectParams,
  layer: HTMLCanvasElement,
  layout: TextLayout,
  settings: RenderSettings,
  glitch: number,
): void {
  const rand = randomFromSeed((params.seed ^ (params.frame * 1103515245)) >>> 0);
  const slices = 3 + Math.floor(settings.chaos * 8);
  const top = layout.y - layout.ascent - params.fontSize * 0.34;
  const bottom = layout.y + layout.descent + params.fontSize * 0.34;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < slices; i += 1) {
    const y = top + rand() * (bottom - top);
    const h = Math.max(2, params.fontSize * (0.05 + rand() * 0.16));
    const offset = (rand() - 0.5) * params.fontSize * settings.chaos * 0.38 * glitch;
    ctx.globalAlpha = 0.26 + rand() * 0.44;
    ctx.drawImage(layer, 0, y, params.width, h, offset, y, params.width, h);
  }
  ctx.restore();
}

function getGlitchAmount(params: TextEffectParams, settings: RenderSettings): number {
  let amount = 0;
  for (let i = 0; i < 5; i += 1) {
    const eventTime = 0.16 + i * 0.16 + (seededValue(params.seed, `event-${i}`) - 0.5) * 0.04;
    const width = 0.018 + seededValue(params.seed, `event-width-${i}`) * 0.028;
    const distance = Math.abs(settings.progress - eventTime);
    if (distance < width) {
      amount = Math.max(amount, Math.sin((1 - distance / width) * Math.PI));
    }
  }

  return clamp((amount + (1 - settings.reveal) * 0.28) * settings.chaos);
}

function tintLayer(source: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d", { alpha: true });

  if (!ctx) {
    throw new Error("Canvas 2D is not available.");
  }

  ctx.drawImage(source, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}
