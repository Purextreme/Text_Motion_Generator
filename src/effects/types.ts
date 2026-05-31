export type BackgroundMode = "transparent" | "black" | "dark-blue";

export interface TextEffectParams {
  text: string;
  frame: number;
  fps: number;
  duration: number;
  width: number;
  height: number;
  fontFamily: string;
  fontSize: number;
  color: string;
  seed: number;
  intensity: number;
  glow: number;
  scanline: number;
  decoration: number;
  background: BackgroundMode;
}

export interface TextEffect {
  id: string;
  name: string;
  version: string;
  description: string;
  render(ctx: CanvasRenderingContext2D, params: TextEffectParams): void;
}

export function defineTextEffect(effect: TextEffect): TextEffect {
  return effect;
}
