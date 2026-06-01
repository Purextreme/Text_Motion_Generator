export interface Layer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

/**
 * 创建离屏 canvas 图层
 * @param width 宽度
 * @param height 高度
 */
export function createLayer(width: number, height: number): Layer {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) {
    throw new Error("无法创建离屏 2D 上下文 (Canvas 2D is not available)");
  }
  return { canvas, ctx };
}

/**
 * 清空离屏 Canvas 图层
 * @param layer 图层对象
 */
export function clearLayer(layer: Layer): void {
  layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
}

/**
 * 将离屏图层或 Canvas 绘制到目标 Context
 * @param targetCtx 目标绘图上下文
 * @param layer 源图层或 Canvas 元素
 * @param alpha 绘制透明度 (可选)
 * @param compositeOperation 混合模式 (可选)
 */
export function drawLayer(
  targetCtx: CanvasRenderingContext2D,
  layer: Layer | HTMLCanvasElement,
  alpha?: number,
  compositeOperation?: GlobalCompositeOperation
): void {
  const sourceCanvas = layer instanceof HTMLCanvasElement ? layer : layer.canvas;
  targetCtx.save();
  if (alpha !== undefined) {
    targetCtx.globalAlpha = alpha;
  }
  if (compositeOperation !== undefined) {
    targetCtx.globalCompositeOperation = compositeOperation;
  }
  targetCtx.drawImage(sourceCanvas, 0, 0);
  targetCtx.restore();
}

/**
 * 在安全的 save() 和 restore() 环境中执行绘图操作
 * @param ctx 绘图上下文
 * @param fn 包含具体绘图逻辑的函数
 */
export function withSavedContext(ctx: CanvasRenderingContext2D, fn: () => void): void {
  ctx.save();
  try {
    fn();
  } finally {
    ctx.restore();
  }
}
