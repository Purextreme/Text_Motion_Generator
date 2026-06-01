import { createLayer } from "./layer";
import { frameRandom } from "./timing";

/**
 * 稳定、高性能的 Canvas RGB 通道分裂效果
 * @param ctx 目标 Canvas 2D 上下文
 * @param sourceCanvas 源 Canvas 元素
 * @param amount 偏移像素距离
 * @param alpha 混合透明度
 */
export function drawRgbSplit(
  ctx: CanvasRenderingContext2D,
  sourceCanvas: HTMLCanvasElement,
  amount: number,
  alpha: number
): void {
  if (amount <= 0.4) {
    ctx.drawImage(sourceCanvas, 0, 0);
    return;
  }

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha;

  // 1. 偏左绘制红色染色层
  const redLayer = tintCanvas(sourceCanvas, "#ff235a");
  ctx.drawImage(redLayer, -amount, 0);

  // 2. 偏右绘制蓝色染色层
  const blueLayer = tintCanvas(sourceCanvas, "#1b7cff");
  ctx.drawImage(blueLayer, amount, 0);

  ctx.restore();

  // 3. 在最上方绘制原始图层叠底
  ctx.drawImage(sourceCanvas, 0, 0);
}

/**
 * 内部辅助染色函数
 */
function tintCanvas(source: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const { canvas, ctx } = createLayer(source.width, source.height);
  ctx.drawImage(source, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * 水平故障切片重组效果
 * @param ctx 目标 Context
 * @param sourceCanvas 源 Canvas 元素
 * @param seed 随机种子
 * @param frame 当前帧
 * @param intensity 故障强度参数
 * @param centerY 故障区域中心 Y
 * @param areaHeight 故障区的高度
 */
export function drawHorizontalSlices(
  ctx: CanvasRenderingContext2D,
  sourceCanvas: HTMLCanvasElement,
  seed: number,
  frame: number,
  intensity: number,
  centerY: number,
  areaHeight: number
): void {
  const slices = 3 + Math.floor(frameRandom(seed, frame, 1) * 6);
  const bandHeight = areaHeight * (0.12 + frameRandom(seed, frame, 2) * 0.25);
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < slices; i += 1) {
    const salt1 = i * 17;
    const salt2 = i * 31;
    const salt3 = i * 47;

    const randomY = centerY + (frameRandom(seed, frame, salt1) - 0.5) * areaHeight * 1.75;
    const randomH = Math.max(2, Math.round(bandHeight * (0.5 + frameRandom(seed, frame, salt2))));
    const y = Math.max(0, Math.min(height - 1, Math.round(randomY)));
    const h = Math.max(1, Math.min(randomH, height - y));
    const offset = (frameRandom(seed, frame, salt3) - 0.5) * areaHeight * 0.42 * intensity;

    ctx.globalAlpha = 0.55 + frameRandom(seed, frame, salt3 + 1) * 0.35;
    ctx.drawImage(sourceCanvas, 0, y, width, h, offset, y, width, h);
  }
  ctx.restore();
}

export interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 绘制扫描线
 * @param ctx 目标 Context
 * @param area 绘制裁切裁剪区域
 * @param opacity 扫描线透明度
 * @param spacing 扫描线间隔
 * @param drift 扫描线垂直滚动偏移
 */
export function drawScanlines(
  ctx: CanvasRenderingContext2D,
  area: Area,
  opacity: number,
  spacing: number,
  drift: number
): void {
  if (opacity <= 0) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(area.x, area.y, area.width, area.height);
  ctx.clip();

  ctx.globalAlpha = opacity;
  ctx.strokeStyle = "#c9ffff";
  ctx.lineWidth = 1;

  const startY = area.y - spacing + (drift % spacing);
  for (let y = startY; y < area.y + area.height + spacing; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(area.x, Math.round(y) + 0.5);
    ctx.lineTo(area.x + area.width, Math.round(y) + 0.5);
    ctx.stroke();
  }

  ctx.restore();
}
