import type { TextEffect } from "./types";

const templateModules = import.meta.glob<{ effect?: TextEffect }>("./templates/*.ts", {
  eager: true,
});

export const effects = Object.values(templateModules)
  .map((module) => module.effect)
  .filter((effect): effect is TextEffect => Boolean(effect))
  .sort((a, b) => a.name.localeCompare(b.name));

export function getDefaultEffect(): TextEffect {
  const effect = effects[0];

  if (!effect) {
    throw new Error("没有找到任何文字效果模板。请在 src/effects/templates/ 中添加模板。");
  }

  return effect;
}
