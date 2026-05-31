# Text Motion Frame Generator MVP

Local web MVP for validating a single high-quality text animation effect: **Cyberpunk Glitch Reveal**.
The default preset is Chinese-first, with `系统已上线` as the starter text and a CJK-friendly font stack.

The current scope is intentionally narrow: Canvas 2D preview, adjustable effect controls, and PNG sequence export as a ZIP. It does not include video export, FFmpeg, AI generation, account systems, timelines, or template management.

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

Open the local URL shown by Vite. The default dev server is configured for `127.0.0.1:5173`.

## Build

```bash
npm run build
```

## Export PNG Sequence

1. Adjust text, font, size, color, background, resolution, FPS, duration, seed, intensity, glow, and scanline.
2. Use the preview to verify the animation.
3. Click **Export PNG ZIP**.
4. Unzip the downloaded archive.
5. Import the frames into After Effects, Premiere, DaVinci Resolve, or another compositor as an image sequence.

Frame files are named:

```txt
text_anim_0000.png
text_anim_0001.png
text_anim_0002.png
```

Transparent background exports preserve alpha in the PNG frames.

## Effect Architecture

Effects implement this interface:

```ts
export interface TextEffect {
  name: string;
  render(ctx: CanvasRenderingContext2D, params: TextEffectParams): void;
}
```

The app renders through the active effect only:

```ts
activeEffect.render(ctx, params);
```

To add a new effect:

1. Create a file under `src/effects/`.
2. Export an object implementing `TextEffect`.
3. Import it in `src/main.ts`.
4. Replace `activeEffect` or add a small selector later.

## Current MVP Limits

- Only one effect is included.
- Export is PNG sequence ZIP only.
- Rendering uses Canvas 2D, not PixiJS or WebGL.
- Long exports at 1080p/60 FPS may take time because frames are encoded in-browser.
- Browser memory limits still apply for large ZIP exports.

## Files

- `src/effects/cyberpunkGlitchReveal.ts`: decode reveal, short glitch bursts, RGB split, glow, scanlines, and HUD lines.
- `src/renderer/canvasRenderer.ts`: canvas setup and frame rendering wrapper.
- `src/renderer/exportPngSequence.ts`: deterministic frame loop and JSZip export.
- `src/utils/seededRandom.ts`: repeatable random helpers.
- `src/utils/easing.ts`: timing helpers.
