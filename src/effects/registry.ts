import type { TextEffect } from "./types";

interface EffectEntry {
  effect: TextEffect;
  index: number;
}

function extractIndex(path: string): number {
  const match = path.match(/(\d+)\./);
  return match ? parseInt(match[1], 10) : 999;
}

const templateModules = import.meta.glob<{ effect?: TextEffect }>("./templates/*.ts", {
  eager: true,
});

const entries: EffectEntry[] = Object.entries(templateModules)
  .map(([path, module]) => {
    if (!module.effect) return null;
    return { effect: module.effect, index: extractIndex(path) };
  })
  .filter((entry): entry is EffectEntry => entry !== null)
  .sort((a, b) => a.index - b.index);

export const effects = entries.map((e) => e.effect);

export function getEffectIndex(effectId: string): number {
  const entry = entries.find((e) => e.effect.id === effectId);
  return entry?.index ?? 0;
}

export function getDefaultEffect(): TextEffect {
  const effect = effects[0];

  if (!effect) {
    throw new Error("没有找到任何文字效果模板。请在 src/effects/templates/ 中添加模板。");
  }

  return effect;
}
