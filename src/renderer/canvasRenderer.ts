import type { TextEffect, TextEffectParams } from "../effects/types";

export function configureCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): CanvasRenderingContext2D {
  if (canvas.width !== width) {
    canvas.width = width;
  }

  if (canvas.height !== height) {
    canvas.height = height;
  }

  const ctx = canvas.getContext("2d", {
    alpha: true,
    desynchronized: true,
  });

  if (!ctx) {
    throw new Error("Canvas 2D is not available in this browser.");
  }

  return ctx;
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  effect: TextEffect,
  params: TextEffectParams,
): void {
  effect.render(ctx, params);
}
