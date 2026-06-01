import { defineTextEffect, type TextEffectParams } from "../types";
import { clamp, smoothstep } from "../../utils/easing";
import { frameRandom, clamp01 } from "../utils/timing";
import { createLayer, drawLayer, withSavedContext } from "../utils/layer";
import { drawRgbSplit, drawScanlines } from "../utils/postprocess";

interface TextLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  ascent: number;
  descent: number;
}

export const effect = defineTextEffect({
  id: "hologram-projection",
  name: "Hologram Projection",
  version: "1.0.0",
  description: "全息投影扫描效果，光束平面扫过文字区域逐层显现，半透明蓝青色界面风格。",
  controls: [
    {
      type: "range",
      id: "intensity",
      label: "扫描/色散强度",
      defaultValue: 0.6,
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      type: "range",
      id: "glow",
      label: "发光强度",
      defaultValue: 0.55,
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      type: "range",
      id: "scanline",
      label: "扫描线/栅格",
      defaultValue: 0.4,
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      type: "range",
      id: "decoration",
      label: "界面装饰",
      defaultValue: 0.6,
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      type: "color",
      id: "hologramColor",
      label: "全息主色",
      defaultValue: "#4dc9f6",
    },
  ],
  render(ctx, params) {
    const { width, height } = params;
    const totalFrames = Math.max(1, Math.round(params.duration * params.fps));
    const progress = clamp01(params.frame / Math.max(1, totalFrames - 1));

    const hologramColor = typeof params.custom.hologramColor === "string" ? params.custom.hologramColor : "#4dc9f6";
    const glow = clamp01(params.glow);
    const intensity = clamp01(params.intensity);
    const deco = clamp01(params.decoration);
    const scanlineVal = clamp01(params.scanline);

    resetCanvas(ctx, width, height);
    drawBackground(ctx, params, hologramColor);

    const layout = measureLayout(ctx, params);

    // 扫描阶段：前 45% 的时间，扫描平面从上到下扫过
    const scanDuration = 0.45;
    const scanProgress = clamp01(progress / scanDuration);
    const scanY = layout.y - layout.ascent - params.fontSize * 0.3 + (layout.height + params.fontSize * 0.6) * scanProgress;

    // 扫描完成后的稳定阶段
    const stablePhase = smoothstep(scanDuration, scanDuration + 0.08, progress);

    // 主文字图层
    const textLayer = createLayer(width, height);
    drawHologramText(textLayer.ctx, params, layout, progress, scanProgress, scanY, stablePhase, hologramColor, glow, intensity);

    // 扫描线光束
    const beamLayer = createLayer(width, height);
    if (scanProgress < 0.98) {
      drawScanBeam(beamLayer.ctx, params, layout, scanY, scanProgress, hologramColor, glow);
    }

    // 色散后处理：扫描线附近有轻微 RGB 分离
    const splitAmount = intensity * params.fontSize * 0.03 * (1 - stablePhase);
    const postLayer = createLayer(width, height);
    drawRgbSplit(postLayer.ctx, textLayer.canvas, splitAmount, 0.25 + intensity * 0.25);
    drawLayer(postLayer.ctx, beamLayer.canvas);

    drawLayer(ctx, postLayer.canvas);

    // 扫描线栅格叠加
    if (scanlineVal > 0) {
      const pad = params.fontSize * 0.6;
      drawScanlines(ctx, {
        x: Math.max(0, layout.x - pad),
        y: Math.max(0, layout.y - layout.ascent - pad),
        width: Math.min(width - Math.max(0, layout.x - pad), layout.width + pad * 2),
        height: Math.min(height - Math.max(0, layout.y - layout.ascent - pad), layout.height + pad * 2),
      }, scanlineVal * 0.18 * (params.background === "transparent" ? 0.7 : 1), Math.max(3, Math.round(params.fontSize * 0.07)), (params.frame * 0.25) % Math.max(3, Math.round(params.fontSize * 0.07)));
    }

    // 界面装饰
    if (deco > 0) {
      drawHologramInterface(ctx, params, layout, progress, scanProgress, stablePhase, hologramColor, deco, glow);
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
    ctx.fillStyle = "#010508";
    ctx.fillRect(0, 0, params.width, params.height);
    return;
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, params.height);
  gradient.addColorStop(0, "#020e18");
  gradient.addColorStop(0.5, "#01070d");
  gradient.addColorStop(1, "#000306");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, params.width, params.height);

  // 微弱的水平线（模拟全息投影底片纹理）
  ctx.save();
  ctx.strokeStyle = accentColor.replace(")", ", 0.018)").replace("rgb", "rgba");
  ctx.lineWidth = 0.5;
  const spacing = 3;
  for (let y = 0; y < params.height; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(params.width, y + 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

function measureLayout(ctx: CanvasRenderingContext2D, params: TextEffectParams): TextLayout {
  ctx.font = `${params.fontWeight} ${params.fontSize}px ${params.fontFamily}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const metrics = ctx.measureText(params.text || " ");
  const ascent = metrics.actualBoundingBoxAscent || params.fontSize * 0.75;
  const descent = metrics.actualBoundingBoxDescent || params.fontSize * 0.25;
  const textWidth = metrics.width;

  return {
    x: (params.width - textWidth) / 2,
    y: params.height * 0.5 + (ascent - descent) / 2,
    width: textWidth,
    height: ascent + descent,
    ascent,
    descent,
  };
}

/**
 * 绘制全息文字
 * 扫描平面上方的文字可见，下方不可见
 */
function drawHologramText(
  ctx: CanvasRenderingContext2D,
  params: TextEffectParams,
  layout: TextLayout,
  progress: number,
  scanProgress: number,
  scanY: number,
  stablePhase: number,
  hologramColor: string,
  glow: number,
  intensity: number,
): void {
  ctx.font = `${params.fontWeight} ${params.fontSize}px ${params.fontFamily}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const textTop = layout.y - layout.ascent;
  const textBottom = layout.y + layout.descent;

  // 在扫描线以上区域用 clip 显示文字
  withSavedContext(ctx, () => {
    if (stablePhase < 0.99) {
      // 扫描中：裁剪扫描线上方的区域
      ctx.beginPath();
      ctx.rect(0, 0, params.width, scanY);
      ctx.clip();
    }

    const appearAlpha = stablePhase > 0.99 ? 1 : 1;
    const flicker = 0.94 + frameRandom(params.seed, params.frame, 50) * 0.06;
    const baseAlpha = appearAlpha * flicker;

    // 第一层：大范围光晕
    ctx.save();
    ctx.globalAlpha = baseAlpha * (0.12 + glow * 0.2);
    ctx.shadowColor = hologramColor;
    ctx.shadowBlur = params.fontSize * (0.2 + glow * 0.5);
    ctx.fillStyle = hologramColor;
    ctx.fillText(params.text, layout.x, layout.y);
    ctx.restore();

    // 第二层：中等发光
    ctx.save();
    ctx.globalAlpha = baseAlpha * (0.35 + glow * 0.35);
    ctx.shadowColor = hologramColor;
    ctx.shadowBlur = params.fontSize * (0.04 + glow * 0.1);
    ctx.fillStyle = hologramColor;
    ctx.fillText(params.text, layout.x, layout.y);
    ctx.restore();

    // 第三层：白色核心
    ctx.save();
    ctx.globalAlpha = baseAlpha * 0.8;
    ctx.fillStyle = "#e8faff";
    ctx.fillText(params.text, layout.x, layout.y);

    ctx.globalCompositeOperation = "source-atop";
    const sheen = ctx.createLinearGradient(layout.x, textTop, layout.x, textBottom);
    sheen.addColorStop(0, "#ffffff");
    sheen.addColorStop(0.35, hologramColor);
    sheen.addColorStop(0.7, "#1a6d8a");
    sheen.addColorStop(1, "#0a3a4a");
    ctx.fillStyle = sheen;
    ctx.fillRect(layout.x - 8, textTop - 8, layout.width + 16, layout.height + 16);
    ctx.restore();

    // 第四层：细描边增加锐度
    ctx.save();
    ctx.globalAlpha = baseAlpha * 0.5;
    ctx.lineWidth = Math.max(1, params.fontSize * 0.012);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.strokeText(params.text, layout.x, layout.y);
    ctx.restore();
  });

  // 扫描线下方：文字仅微弱可见（半透明暗色）
  if (stablePhase < 0.99 && scanY < textBottom) {
    withSavedContext(ctx, () => {
      ctx.beginPath();
      ctx.rect(0, scanY, params.width, params.height - scanY);
      ctx.clip();

      ctx.globalAlpha = 0.08 + intensity * 0.06;
      ctx.fillStyle = hologramColor;
      ctx.shadowColor = hologramColor;
      ctx.shadowBlur = params.fontSize * 0.06;
      ctx.fillText(params.text, layout.x, layout.y);
    });
  }
}

/**
 * 扫描线光束
 * 明亮的水平线带辉光，两端有能量指示器
 */
function drawScanBeam(
  ctx: CanvasRenderingContext2D,
  params: TextEffectParams,
  layout: TextLayout,
  scanY: number,
  scanProgress: number,
  hologramColor: string,
  glow: number,
): void {
  const padX = params.fontSize * 0.4;
  const left = layout.x - padX;
  const right = layout.x + layout.width + padX;
  const beamHalfHeight = params.fontSize * 0.06;

  // 光束主体渐变
  const grad = ctx.createLinearGradient(0, scanY - beamHalfHeight * 3, 0, scanY + beamHalfHeight * 3);
  grad.addColorStop(0, "transparent");
  grad.addColorStop(0.35, hologramColor.replace(")", ", 0.3)").replace("rgb", "rgba"));
  grad.addColorStop(0.48, "#ffffff");
  grad.addColorStop(0.5, "#ffffff");
  grad.addColorStop(0.52, hologramColor.replace(")", ", 0.3)").replace("rgb", "rgba"));
  grad.addColorStop(1, "transparent");

  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = grad;
  ctx.fillRect(0, scanY - beamHalfHeight * 3, params.width, beamHalfHeight * 6);

  // 中心最亮线
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(1, params.fontSize * 0.015);
  ctx.shadowColor = hologramColor;
  ctx.shadowBlur = params.fontSize * (0.12 + glow * 0.18);
  ctx.beginPath();
  ctx.moveTo(left - 20, scanY);
  ctx.lineTo(right + 20, scanY);
  ctx.stroke();
  ctx.restore();

  // 光束两端的能量指示
  const indicatorAlpha = 0.6 + Math.sin(params.frame * 0.3) * 0.3;
  ctx.save();
  ctx.globalAlpha = indicatorAlpha;
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = hologramColor;
  ctx.shadowBlur = params.fontSize * 0.15;

  const indSize = params.fontSize * 0.06;
  ctx.fillRect(left - 25, scanY - indSize, indSize * 0.6, indSize * 2);
  ctx.fillRect(right + 23, scanY - indSize, indSize * 0.6, indSize * 2);
  ctx.restore();
}

/**
 * 全息界面装饰
 */
function drawHologramInterface(
  ctx: CanvasRenderingContext2D,
  params: TextEffectParams,
  layout: TextLayout,
  progress: number,
  scanProgress: number,
  stablePhase: number,
  hologramColor: string,
  deco: number,
  glow: number,
): void {
  const padX = params.fontSize * 0.28;
  const padY = params.fontSize * 0.24;
  const left = layout.x - padX;
  const right = layout.x + layout.width + padX;
  const top = layout.y - layout.ascent - padY;
  const bottom = layout.y + layout.descent + padY * 0.7;

  const flicker = 0.82 + Math.sin(params.frame * 0.15 + params.seed) * 0.18;
  const alpha = deco * flicker * smoothstep(0.05, 0.2, progress);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = hologramColor;
  ctx.fillStyle = hologramColor;
  ctx.lineWidth = Math.max(1, params.fontSize * 0.013);
  ctx.shadowColor = hologramColor;
  ctx.shadowBlur = params.fontSize * (0.03 + glow * 0.06);

  // 四角括号（比普通角标更宽）
  const cornerSz = params.fontSize * 0.18;
  drawCorner(ctx, left, top, cornerSz, 1, 1);
  drawCorner(ctx, right, top, cornerSz, -1, 1);
  drawCorner(ctx, left, bottom, cornerSz, 1, -1);
  drawCorner(ctx, right, bottom, cornerSz, -1, -1);

  // 虚线边框（全息风格）
  ctx.setLineDash([params.fontSize * 0.12, params.fontSize * 0.08]);
  ctx.strokeRect(left, top, right - left, bottom - top);
  ctx.setLineDash([]);

  // 左上：扫描状态标签
  const labelFontSize = Math.max(9, Math.round(params.fontSize * 0.09));
  ctx.font = `600 ${labelFontSize}px monospace`;

  if (stablePhase < 0.99) {
    const pct = Math.round(scanProgress * 100);
    ctx.fillText(`SCANNING... ${pct}%`, left, top - labelFontSize * 0.8);
  } else {
    ctx.fillText("PROJECTION STABLE", left, top - labelFontSize * 0.8);
  }

  // 右上：帧/分辨率信息
  const resText = `${params.width}×${params.height}`;
  const resWidth = ctx.measureText(resText).width;
  ctx.fillText(resText, right - resWidth, top - labelFontSize * 0.8);

  // 左下：进度条
  const barY = bottom + labelFontSize * 1.2;
  const barW = right - left;
  const barH = Math.max(1, params.fontSize * 0.018);
  ctx.globalAlpha = alpha * 0.6;
  ctx.strokeStyle = hologramColor;
  ctx.lineWidth = 0.5;
  ctx.strokeRect(left, barY, barW, barH);
  const fillW = barW * smoothstep(0.05, 0.9, progress);
  ctx.fillRect(left + 1, barY + 0.5, fillW - 2, barH - 1);

  // 进度条上的当前位置标记
  const markerX = left + fillW;
  ctx.fillStyle = "#ffffff";
  ctx.shadowBlur = params.fontSize * 0.08;
  ctx.fillRect(markerX - 1.5, barY - 2, 3, barH + 4);

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
