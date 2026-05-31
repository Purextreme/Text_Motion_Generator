export type BackgroundMode = "transparent" | "black" | "dark-blue";
export type TextEffectControlValue = string | number | boolean;

export type TextEffectControl =
  | {
      type: "range" | "number";
      id: string;
      label: string;
      defaultValue: number;
      min?: number;
      max?: number;
      step?: number;
    }
  | {
      type: "color" | "text";
      id: string;
      label: string;
      defaultValue: string;
    }
  | {
      type: "select";
      id: string;
      label: string;
      defaultValue: string;
      options: Array<{ label: string; value: string }>;
    }
  | {
      type: "checkbox";
      id: string;
      label: string;
      defaultValue: boolean;
    };

export interface TextEffectParams {
  text: string;
  frame: number;
  fps: number;
  duration: number;
  width: number;
  height: number;
  fontFamily: string;
  fontWeight: string;
  fontSize: number;
  color: string;
  seed: number;
  intensity: number;
  glow: number;
  scanline: number;
  decoration: number;
  background: BackgroundMode;
  custom: Record<string, TextEffectControlValue>;
}

export interface TextEffect {
  id: string;
  name: string;
  version: string;
  description: string;
  controls?: TextEffectControl[];
  render(ctx: CanvasRenderingContext2D, params: TextEffectParams): void;
}

export function defineTextEffect(effect: TextEffect): TextEffect {
  return effect;
}
