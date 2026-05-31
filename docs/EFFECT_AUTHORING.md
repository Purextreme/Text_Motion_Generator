# 效果模板编写指南

这个文档用于给人或其他模型生成新的文字动效模板。目标是让生成的代码可以直接放入项目，并出现在前端页面的“效果模板”下拉框中。

## 放置位置

把新效果文件放到：

```txt
src/effects/templates/
```

文件名建议使用英文小驼峰或短横线，例如：

```txt
techPulseReveal.ts
inkBrushAppear.ts
```

## 标准代码骨架

```ts
import { defineTextEffect } from "../types";

export const effect = defineTextEffect({
  id: "tech-pulse-reveal",
  name: "Tech Pulse Reveal",
  version: "1.0.0",
  description: "科技感脉冲出现文字效果。",
  controls: [
    {
      type: "range",
      id: "pulse",
      label: "脉冲强度",
      defaultValue: 0.6,
      min: 0,
      max: 1,
      step: 0.01,
    },
  ],
  render(ctx, params) {
    const progress = params.frame / Math.max(1, Math.round(params.duration * params.fps) - 1);
    const pulse = typeof params.custom.pulse === "number" ? params.custom.pulse : 0.6;

    ctx.clearRect(0, 0, params.width, params.height);

    if (params.background === "black") {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, params.width, params.height);
    }

    ctx.font = `900 ${params.fontSize}px ${params.fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = params.color;
    ctx.globalAlpha = progress * (0.5 + pulse * 0.5);
    ctx.fillText(params.text, params.width / 2, params.height / 2);
  },
});
```

## 基础参数

- `text`: 用户输入的文字。
- `frame`: 当前帧编号。
- `fps`: 帧率。
- `duration`: 时长，单位秒。
- `width` / `height`: 实际导出分辨率。
- `fontFamily`: 当前字体。
- `fontSize`: 字号。
- `color`: 主颜色。
- `seed`: 随机种子。
- `background`: `transparent`、`black` 或 `dark-blue`。
- `custom`: 当前模板自己声明的自定义参数。

## 自定义参数

每个模板都可以声明自己的 `controls`。主程序会根据当前效果自动显示这些控件，并把用户调整后的值放到 `params.custom`。

支持的控件类型：

- `range`: 滑杆，适合 0 到 1 的强度参数。
- `number`: 数字输入。
- `color`: 颜色输入，值是 `#rrggbb`。
- `select`: 下拉选择。
- `checkbox`: 开关，值是 `boolean`。
- `text`: 短文本输入。

示例：

```ts
controls: [
  { type: "range", id: "trail", label: "拖影", defaultValue: 0.45, min: 0, max: 1, step: 0.01 },
  { type: "color", id: "accentColor", label: "强调色", defaultValue: "#ff2e75" },
  {
    type: "select",
    id: "direction",
    label: "方向",
    defaultValue: "left",
    options: [
      { label: "Left", value: "left" },
      { label: "Right", value: "right" },
    ],
  },
]
```

读取自定义参数时必须做类型兜底：

```ts
const trail = typeof params.custom.trail === "number" ? params.custom.trail : 0.45;
const accentColor = typeof params.custom.accentColor === "string" ? params.custom.accentColor : "#ff2e75";
```

## 必须遵守

- 只使用 Canvas 2D 绘制当前帧。
- 每一帧必须由 `params.frame` 和参数确定，方便稳定导出。
- 默认应聚焦文字本体效果。
- 可以画围绕文字的小框线、短线、小方块等局部装饰。
- 如果要画边框、HUD 线、小方块等非文字元素，必须受模板自己的装饰类自定义参数控制。
- 装饰类参数关闭或为 0 时，不要绘制文字以外的装饰。
- 不要画全屏边框或大面积 HUD 面板。
- 透明背景时不要强行铺满背景色。

## 禁止事项

- 不要访问网络。
- 不要修改 DOM。
- 不要创建按钮、输入框或页面 UI。
- 不要读取用户文件。
- 不要依赖外部图片、字体文件或远程资源。
- 不要做全屏复杂 HUD 框架。
- 不要修改导出逻辑。
- 不要修改主程序。

## 给其他模型的提示词模板

```txt
请为这个项目生成一个新的 Canvas 2D 中文文字动效模板。

要求：
- 只输出一个 TypeScript 文件的代码。
- 文件会放到 src/effects/templates/。
- 必须 import { defineTextEffect } from "../types";
- 必须导出 export const effect = defineTextEffect({...});
- render(ctx, params) 只绘制当前帧。
- 默认聚焦文字本体，不要默认绘制大边框或全屏 HUD。
- 可以声明 controls，每个效果可以有自己的参数。
- 可以绘制围绕文字的局部装饰；必须由 controls 中的装饰类参数控制，关闭或为 0 时不绘制。
- 自定义参数必须通过 params.custom.xxx 读取，并做好类型兜底。
- 必须支持 transparent 背景 alpha。
- 不要访问网络，不要修改 DOM，不要依赖外部资源。

我想要的效果主题是：[在这里写主题，例如“科技蓝色扫描出现”]。
```
