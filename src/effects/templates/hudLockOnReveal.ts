import { defineTextEffect, type TextEffectParams } from "../types";
import { clamp01, frameRandom, smoothPulse } from "../utils/timing";
import { createLayer, drawLayer, withSavedContext } from "../utils/layer";
import { drawHorizontalSlices, drawRgbSplit, drawScanlines } from "../utils/postprocess";

interface TextLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  ascent: number;
  descent: number;
}

export const effect = defineTextEffect({
  id: "hud-lock-on-reveal",
  name: "HUD Lock-On Reveal",
  version: "1.0.0",
  description: "高科技游戏 HUD 锁定扫描出现，伴随轻微故障与呼吸发光效果。",
  controls: [
    {
      type: "range",
      id: "intensity",
      label: "故障强度",
      defaultValue: 0.55,
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      type: "range",
      id: "glow",
      label: "发光强度",
      defaultValue: 0.5,
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      type: "range",
      id: "scanline",
      label: "扫描线强度",
      defaultValue: 0.45,
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      type: "range",
      id: "decoration",
      label: "装饰强度",
      defaultValue: 0.6,
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      type: "color",
      id: "lockColor",
      label: "锁定强调色",
      defaultValue: "#ffcc33",
    },
  ],
  render(ctx, params) {
    const { width, height } = params;
    const totalFrames = Math.max(1, Math.round(params.duration * params.fps));
    const progress = clamp01(params.frame / Math.max(1, totalFrames - 1));

    // 1. 重置画布并渲染背景
    resetCanvas(ctx, width, height);
    drawBackground(ctx, params);

    // 2. 测量文字排版
    const layout = measureLayout(ctx, params);

    const revealProgress = clamp01(progress / 0.4);
    const glitchPulse =
      smoothPulse(progress, 0.34, 0.018) +
      smoothPulse(progress, 0.42, 0.016) +
      smoothPulse(progress, 0.5, 0.014);
    const localGlitchAmp = clamp01(glitchPulse) * frameRandom(params.seed, params.frame, 42) * params.intensity;

    // 4. 创建文字渲染离屏图层
    const textLayer = createLayer(width, height);
    drawTextToLayer(textLayer.ctx, params, layout, progress, revealProgress, localGlitchAmp);

    // 5. 绘制 HUD 锁定装饰（在主 Canvas 上绘制，这样不会受 RGB 分裂和切片故障的像素后处理影响，显得更加清晰精致）
    if (params.decoration > 0) {
      drawHudLockDecoration(ctx, params, layout, progress, localGlitchAmp);
    }

    // 6. 进行后处理 (RGB 分裂、水平切片) 并合并到主画布
    const postLayer = createLayer(width, height);
    const splitOffset = params.fontSize * (0.005 + localGlitchAmp * 0.08) * params.intensity;
    const splitAlpha = 0.22 + localGlitchAmp * 0.45;
    
    // 渲染 RGB 分裂后处理
    drawRgbSplit(postLayer.ctx, textLayer.canvas, splitOffset, splitAlpha);

    // 如果处于强故障帧，添加水平切片后处理
    if (localGlitchAmp > 0.3) {
      drawHorizontalSlices(
        postLayer.ctx,
        postLayer.canvas,
        params.seed,
        params.frame,
        params.intensity * localGlitchAmp,
        layout.y - layout.ascent * 0.5,
        layout.height + params.fontSize * 0.35
      );
    }

    // 把后处理图层绘制到主 Canvas 上
    drawLayer(ctx, postLayer.canvas);

    // 7. 绘制全局扫描线效果 (局限在文字区域周边)
    if (params.scanline > 0) {
      const pad = params.fontSize * 0.5;
      const area = {
        x: Math.max(0, layout.x - pad),
        y: Math.max(0, layout.y - layout.ascent - pad),
        width: Math.min(width - Math.max(0, layout.x - pad), layout.width + pad * 2),
        height: Math.min(height - Math.max(0, layout.y - layout.ascent - pad), layout.height + pad * 2),
      };
      
      const scanOpacity = params.scanline * (params.background === "transparent" ? 0.15 : 0.22) * clamp01(progress / 0.15);
      const spacing = Math.max(3, Math.round(params.fontSize * 0.08));
      const drift = (params.frame * 0.3) % spacing;
      drawScanlines(ctx, area, scanOpacity, spacing, drift);
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
    ctx.fillStyle = "#030406";
    ctx.fillRect(0, 0, params.width, params.height);
    return;
  }

  // 暗蓝渐变背景
  const gradient = ctx.createRadialGradient(
    params.width * 0.5,
    params.height * 0.48,
    0,
    params.width * 0.5,
    params.height * 0.5,
    Math.max(params.width, params.height) * 0.65
  );
  gradient.addColorStop(0, "#061322");
  gradient.addColorStop(0.5, "#020914");
  gradient.addColorStop(1, "#000307");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, params.width, params.height);
}

function measureLayout(ctx: CanvasRenderingContext2D, params: TextEffectParams): TextLayout {
  ctx.font = `${params.fontWeight} ${params.fontSize}px ${params.fontFamily}`;
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

/**
 * 绘制主体文字到离屏图层上
 */
function drawTextToLayer(
  ctx: CanvasRenderingContext2D,
  params: TextEffectParams,
  layout: TextLayout,
  progress: number,
  revealProgress: number,
  glitchAmp: number
): void {
  ctx.font = `${params.fontWeight} ${params.fontSize}px ${params.fontFamily}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const appear = clamp01(progress / 0.1);
  const glow = clamp01(params.glow);

  // 呼吸发光波形 (progress >= 0.4 稳定期才完全生效，前段做平滑过渡)
  const glowFreq = progress * Math.PI * 4;
  const pulse = 0.88 + Math.sin(glowFreq + params.seed) * 0.12 * clamp01((progress - 0.3) / 0.2);

  withSavedContext(ctx, () => {
    // 裁剪文字：根据 revealProgress 自上而下露出
    const top = layout.y - layout.ascent;
    const scanY = top + layout.height * revealProgress;
    
    // 如果 revealProgress 还未完成，利用 clip 进行扫描裁切
    if (revealProgress < 1.0) {
      ctx.beginPath();
      ctx.rect(layout.x - 20, top - 20, layout.width + 40, scanY - top + 20);
      ctx.clip();
    }

    // 1. 底层大发光 Glow 层
    ctx.save();
    ctx.globalAlpha = appear * (0.15 + glow * 0.22) * pulse;
    ctx.shadowColor = params.color;
    ctx.shadowBlur = params.fontSize * (0.22 + glow * 0.5);
    ctx.fillStyle = params.color;
    ctx.fillText(params.text, layout.x, layout.y);
    ctx.restore();

    // 2. 中层微发光 Neon 层
    ctx.save();
    ctx.globalAlpha = appear * (0.42 + glow * 0.36) * pulse;
    ctx.shadowColor = params.color;
    ctx.shadowBlur = params.fontSize * (0.05 + glow * 0.1);
    ctx.fillStyle = params.color;
    ctx.fillText(params.text, layout.x, layout.y);
    ctx.restore();

    // 3. 顶层白色金属渐变层
    ctx.save();
    ctx.globalAlpha = appear;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(params.text, layout.x, layout.y);

    ctx.globalCompositeOperation = "source-atop";
    const gradient = ctx.createLinearGradient(
      layout.x,
      layout.y - layout.ascent,
      layout.x,
      layout.y + layout.descent
    );
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.38, params.color);
    gradient.addColorStop(1, "#369eff");
    ctx.fillStyle = gradient;
    ctx.fillRect(layout.x - 10, layout.y - layout.ascent - 10, layout.width + 20, layout.height + 20);
    ctx.restore();

    // 4. 文字细描边（增加高频轮廓细节质感）
    ctx.save();
    ctx.globalAlpha = appear * 0.65;
    ctx.lineWidth = Math.max(1, params.fontSize * 0.015);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
    ctx.strokeText(params.text, layout.x, layout.y);
    ctx.restore();
  });
}

/**
 * 绘制围绕文字周边的 HUD 锁定与扫描装饰
 */
function drawHudLockDecoration(
  ctx: CanvasRenderingContext2D,
  params: TextEffectParams,
  layout: TextLayout,
  progress: number,
  glitchAmp: number
): void {
  const deco = clamp01(params.decoration);
  const lockColor = typeof params.custom.lockColor === "string" ? params.custom.lockColor : "#ffcc33";

  // 1. 扫描锁定线 (配合 reveal 进度，自上往下扫)
  const revealProgress = clamp01(progress / 0.4);
  const padX = params.fontSize * 0.28;
  const padY = params.fontSize * 0.25;

  const left = layout.x - padX;
  const right = layout.x + layout.width + padX;
  const top = layout.y - layout.ascent - padY;
  const bottom = layout.y + layout.descent + padY * 0.8;
  const width = right - left;
  const height = bottom - top;

  const scanY = top + height * revealProgress;

  // 1. 扫描锁定线绘制（从上往下）
  if (revealProgress > 0 && revealProgress < 0.99) {
    const flicker = 0.75 + frameRandom(params.seed, params.frame, 10) * 0.25;
    ctx.save();
    ctx.globalAlpha = flicker * deco * 0.85;
    ctx.strokeStyle = lockColor;
    ctx.shadowColor = lockColor;
    ctx.shadowBlur = params.fontSize * 0.15;
    ctx.lineWidth = Math.max(2, params.fontSize * 0.02);

    // 水平横线扫描线
    ctx.beginPath();
    ctx.moveTo(left - 15, scanY);
    ctx.lineTo(right + 15, scanY);
    ctx.stroke();

    // 扫描线两端的小微型角标
    ctx.fillStyle = lockColor;
    ctx.fillRect(left - 15, scanY - 4, 3, 8);
    ctx.fillRect(right + 12, scanY - 4, 3, 8);
    ctx.restore();
  }

  // 2. HUD 聚拢与锁定框 (前 0.4 进度中向内聚拢，0.4 之后卡在四角并有轻微呼吸发光)
  let shrink = 0;
  if (revealProgress < 1.0) {
    // 聚拢因子，从 1 到 0 递减
    shrink = (1 - revealProgress) * params.fontSize * 0.75;
  }

  // 呼吸发光透明度
  const flicker = 0.82 + Math.sin(progress * Math.PI * 4 + params.seed) * 0.18;
  const alpha = clamp01(progress / 0.08) * deco * flicker * (0.65 + glitchAmp * 0.35);

  const cornerSize = params.fontSize * 0.18;
  const tickSize = params.fontSize * 0.28;
  const squareSize = Math.max(4, params.fontSize * 0.05);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = lockColor;
  ctx.fillStyle = lockColor;
  ctx.lineWidth = Math.max(1.8, params.fontSize * 0.016);
  ctx.shadowColor = lockColor;
  ctx.shadowBlur = params.fontSize * (0.04 + params.glow * 0.08);

  // 四角锁定框（收缩定位）
  drawCorner(ctx, left - shrink, top - shrink, cornerSize, 1, 1);
  drawCorner(ctx, right + shrink, top - shrink, cornerSize, -1, 1);
  drawCorner(ctx, left - shrink, bottom + shrink, cornerSize, 1, -1);
  drawCorner(ctx, right + shrink, bottom + shrink, cornerSize, -1, -1);

  // 稳定后，在四角外侧绘制轻微的小方块角标
  if (revealProgress >= 1.0) {
    ctx.fillRect(left - cornerSize - 8, top - 2, squareSize, squareSize);
    ctx.fillRect(right + cornerSize + 4, top - 2, squareSize, squareSize);
    ctx.fillRect(left - cornerSize - 8, bottom - 2, squareSize, squareSize);
    ctx.fillRect(right + cornerSize + 4, bottom - 2, squareSize, squareSize);
  }

  // 左右两侧的锁定状态刻度尺与十字标线
  ctx.beginPath();
  // 左侧标线
  ctx.moveTo(left - tickSize * 1.1, layout.y - layout.ascent * 0.15);
  ctx.lineTo(left - tickSize * 0.25, layout.y - layout.ascent * 0.15);
  // 右侧标线
  ctx.moveTo(right + tickSize * 0.25, layout.y - layout.ascent * 0.15);
  ctx.lineTo(right + tickSize * 1.1, layout.y - layout.ascent * 0.15);
  ctx.stroke();

  // 标线末尾的指示点
  ctx.fillRect(left - tickSize * 1.35, layout.y - layout.ascent * 0.15 - 2, 3, 4);
  ctx.fillRect(right + tickSize * 1.25, layout.y - layout.ascent * 0.15 - 2, 3, 4);

  // 文字正下方绘制进度锁定状态条
  if (revealProgress >= 0.85) {
    const lockBarWidth = layout.width * 0.22;
    const lockBarHeight = 3;
    const barX = layout.x + (layout.width - lockBarWidth) / 2;
    const barY = bottom + 12;

    ctx.save();
    ctx.globalAlpha = alpha * 0.5;
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, lockBarWidth, lockBarHeight);
    
    // 实心部分
    ctx.fillRect(barX + 2, barY + 1, (lockBarWidth - 4) * clamp01((progress - 0.35) / 0.65), lockBarHeight - 2);
    ctx.restore();
  }

  ctx.restore();
}

function drawCorner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  xDir: 1 | -1,
  yDir: 1 | -1
): void {
  ctx.beginPath();
  ctx.moveTo(x, y + yDir * size);
  ctx.lineTo(x, y);
  ctx.lineTo(x + xDir * size, y);
  ctx.stroke();
}
