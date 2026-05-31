import JSZip from "jszip";
import type { TextEffect, TextEffectParams } from "../effects/types";
import { configureCanvas, renderFrame } from "./canvasRenderer";

export interface ExportProgress {
  current: number;
  total: number;
  phase: "rendering" | "zipping";
}

export async function exportPngSequenceZip(
  effect: TextEffect,
  baseParams: Omit<TextEffectParams, "frame">,
  onProgress: (progress: ExportProgress) => void,
): Promise<Blob> {
  const totalFrames = Math.max(1, Math.round(baseParams.duration * baseParams.fps));
  const canvas = document.createElement("canvas");
  const ctx = configureCanvas(canvas, baseParams.width, baseParams.height);
  const zip = new JSZip();

  for (let frame = 0; frame < totalFrames; frame += 1) {
    renderFrame(ctx, effect, {
      ...baseParams,
      frame,
    });

    const blob = await canvasToPngBlob(canvas);
    zip.file(`text_anim_${String(frame).padStart(4, "0")}.png`, blob);
    onProgress({ current: frame + 1, total: totalFrames, phase: "rendering" });

    if (frame % 2 === 0) {
      await yieldToBrowser();
    }
  }

  onProgress({ current: totalFrames, total: totalFrames, phase: "zipping" });
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" }, (metadata) => {
    onProgress({
      current: Math.round((metadata.percent / 100) * totalFrames),
      total: totalFrames,
      phase: "zipping",
    });
  });
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to encode PNG frame."));
        return;
      }

      resolve(blob);
    }, "image/png");
  });
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}
