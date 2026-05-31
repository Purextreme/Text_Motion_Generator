import "./styles.css";
import { cyberpunkGlitchReveal } from "./effects/cyberpunkGlitchReveal";
import type { BackgroundMode, TextEffectParams } from "./effects/types";
import { configureCanvas, renderFrame } from "./renderer/canvasRenderer";
import { exportPngSequenceZip } from "./renderer/exportPngSequence";

interface AppState {
  text: string;
  resolution: string;
  fps: number;
  duration: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  seed: number;
  intensity: number;
  glow: number;
  scanline: number;
  background: BackgroundMode;
  isPlaying: boolean;
  frame: number;
}

const activeEffect = cyberpunkGlitchReveal;

const state: AppState = {
  text: "系统已上线",
  resolution: "1920x1080",
  fps: 30,
  duration: 2,
  fontSize: 96,
  fontFamily: '"Microsoft YaHei UI", "PingFang SC", "Noto Sans CJK SC", "Source Han Sans SC", sans-serif',
  color: "#00f6ff",
  seed: 1234,
  intensity: 0.75,
  glow: 0.6,
  scanline: 0.35,
  background: "transparent",
  isPlaying: true,
  frame: 0,
};

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app mount node.");
}

app.innerHTML = `
  <main class="app-shell">
    <aside class="control-panel">
      <section class="brand">
        <p class="eyebrow">MVP frame generator</p>
        <h1>Text Motion</h1>
        <p class="effect-name">${activeEffect.name}</p>
      </section>

      <section class="control-grid">
        <label class="control">
          <span>Text</span>
          <input id="text" type="text" value="${state.text}" />
        </label>

        <label class="control">
          <span>Font family</span>
          <input id="fontFamily" type="text" value="${state.fontFamily}" />
        </label>

        <div class="inline-grid">
          <label class="control">
            <span>Font size</span>
            <input id="fontSize" type="number" min="24" max="260" step="1" value="${state.fontSize}" />
          </label>
          <label class="control">
            <span>Main color</span>
            <input id="color" type="color" value="${state.color}" />
          </label>
        </div>

        <div class="inline-grid">
          <label class="control">
            <span>Background</span>
            <select id="background">
              <option value="transparent">transparent</option>
              <option value="black">black</option>
              <option value="dark-blue">dark blue</option>
            </select>
          </label>
          <label class="control">
            <span>Resolution</span>
            <select id="resolution">
              <option value="1920x1080">1920x1080</option>
              <option value="1080x1080">1080x1080</option>
              <option value="1080x1920">1080x1920</option>
            </select>
          </label>
        </div>

        <div class="inline-grid">
          <label class="control">
            <span>FPS</span>
            <select id="fps">
              <option value="24">24</option>
              <option value="30">30</option>
              <option value="60">60</option>
            </select>
          </label>
          <label class="control">
            <span>Duration</span>
            <input id="duration" type="number" min="0.25" max="10" step="0.25" value="${state.duration}" />
          </label>
        </div>

        <label class="control">
          <span>Seed</span>
          <input id="seed" type="number" step="1" value="${state.seed}" />
        </label>

        <label class="control">
          <span class="value-row"><span>Intensity</span><output id="intensityValue">${state.intensity.toFixed(2)}</output></span>
          <input id="intensity" type="range" min="0" max="1" step="0.01" value="${state.intensity}" />
        </label>

        <label class="control">
          <span class="value-row"><span>Glow</span><output id="glowValue">${state.glow.toFixed(2)}</output></span>
          <input id="glow" type="range" min="0" max="1" step="0.01" value="${state.glow}" />
        </label>

        <label class="control">
          <span class="value-row"><span>Scanline</span><output id="scanlineValue">${state.scanline.toFixed(2)}</output></span>
          <input id="scanline" type="range" min="0" max="1" step="0.01" value="${state.scanline}" />
        </label>
      </section>

      <section class="button-row">
        <button id="playPause" type="button">Pause</button>
        <button id="export" type="button" class="export-button">Export PNG ZIP</button>
      </section>

      <div class="progress-wrap">
        <progress id="exportProgress" value="0" max="1"></progress>
        <div id="exportStatus" class="progress-text">Ready</div>
      </div>
    </aside>

    <section class="preview-panel">
      <div class="canvas-stage">
        <canvas id="preview" aria-label="Animation preview"></canvas>
      </div>
      <div class="transport">
        <div id="timecode" class="timecode">00:00 / 00:02</div>
        <input id="timeline" type="range" min="0" max="59" step="1" value="0" />
        <div id="frameReadout" class="progress-text">Frame 0</div>
      </div>
    </section>
  </main>
`;

const canvas = getElement<HTMLCanvasElement>("preview");
const playPauseButton = getElement<HTMLButtonElement>("playPause");
const exportButton = getElement<HTMLButtonElement>("export");
const timeline = getElement<HTMLInputElement>("timeline");
const timecode = getElement<HTMLDivElement>("timecode");
const frameReadout = getElement<HTMLDivElement>("frameReadout");
const exportProgress = getElement<HTMLProgressElement>("exportProgress");
const exportStatus = getElement<HTMLDivElement>("exportStatus");

let lastTimestamp = performance.now();
let ctx = configureCanvas(canvas, getDimensions().width, getDimensions().height);

bindControls();
renderCurrentFrame();
requestAnimationFrame(tick);

function bindControls(): void {
  bindInput("text", (value) => {
    state.text = value;
  });
  bindInput("fontFamily", (value) => {
    state.fontFamily = value.trim() || "sans-serif";
  });
  bindNumber("fontSize", (value) => {
    state.fontSize = value;
  });
  bindInput("color", (value) => {
    state.color = value;
  });
  bindSelect("background", (value) => {
    state.background = value as BackgroundMode;
  });
  bindSelect("resolution", (value) => {
    state.resolution = value;
    const { width, height } = getDimensions();
    ctx = configureCanvas(canvas, width, height);
    clampFrame();
  });
  bindSelect("fps", (value) => {
    state.fps = Number(value);
    clampFrame();
    syncTimeline();
  });
  bindNumber("duration", (value) => {
    state.duration = Math.max(0.25, value);
    clampFrame();
    syncTimeline();
  });
  bindNumber("seed", (value) => {
    state.seed = Math.round(value);
  });
  bindRange("intensity", "intensityValue", (value) => {
    state.intensity = value;
  });
  bindRange("glow", "glowValue", (value) => {
    state.glow = value;
  });
  bindRange("scanline", "scanlineValue", (value) => {
    state.scanline = value;
  });

  playPauseButton.addEventListener("click", () => {
    state.isPlaying = !state.isPlaying;
    playPauseButton.textContent = state.isPlaying ? "Pause" : "Play";
    lastTimestamp = performance.now();
  });

  timeline.addEventListener("input", () => {
    state.frame = Number(timeline.value);
    state.isPlaying = false;
    playPauseButton.textContent = "Play";
    renderCurrentFrame();
  });

  exportButton.addEventListener("click", () => {
    void exportSequence();
  });

  getElement<HTMLSelectElement>("background").value = state.background;
  getElement<HTMLSelectElement>("resolution").value = state.resolution;
  getElement<HTMLSelectElement>("fps").value = String(state.fps);
  syncTimeline();
}

function tick(timestamp: number): void {
  if (state.isPlaying) {
    const elapsed = timestamp - lastTimestamp;
    const frameAdvance = Math.floor((elapsed / 1000) * state.fps);

    if (frameAdvance > 0) {
      state.frame = (state.frame + frameAdvance) % getTotalFrames();
      lastTimestamp = timestamp;
      renderCurrentFrame();
    }
  } else {
    lastTimestamp = timestamp;
  }

  requestAnimationFrame(tick);
}

function renderCurrentFrame(): void {
  const dimensions = getDimensions();
  const nextCtx = configureCanvas(canvas, dimensions.width, dimensions.height);
  ctx = nextCtx;
  renderFrame(ctx, activeEffect, getRenderParams(state.frame));
  syncTimeline();
}

function getRenderParams(frame: number): TextEffectParams {
  const dimensions = getDimensions();
  return {
    text: state.text,
    frame,
    fps: state.fps,
    duration: state.duration,
    width: dimensions.width,
    height: dimensions.height,
    fontFamily: state.fontFamily,
    fontSize: state.fontSize,
    color: state.color,
    seed: state.seed,
    intensity: state.intensity,
    glow: state.glow,
    scanline: state.scanline,
    background: state.background,
  };
}

async function exportSequence(): Promise<void> {
  exportButton.disabled = true;
  exportProgress.value = 0;
  exportStatus.textContent = "Rendering frames...";

  try {
    const blob = await exportPngSequenceZip(activeEffect, getRenderParams(0), (progress) => {
      exportProgress.value = progress.current / progress.total;
      exportStatus.textContent =
        progress.phase === "zipping"
          ? `Zipping ${Math.round((progress.current / progress.total) * 100)}%`
          : `Rendering ${progress.current} / ${progress.total}`;
    });

    downloadBlob(blob, `text_anim_${state.resolution}_${state.fps}fps.zip`);
    exportStatus.textContent = "Export complete";
  } catch (error) {
    exportStatus.textContent = error instanceof Error ? error.message : "Export failed";
  } finally {
    exportButton.disabled = false;
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function syncTimeline(): void {
  const totalFrames = getTotalFrames();
  timeline.max = String(totalFrames - 1);
  timeline.value = String(state.frame);
  timecode.textContent = `${formatTime(state.frame / state.fps)} / ${formatTime(state.duration)}`;
  frameReadout.textContent = `Frame ${state.frame} / ${totalFrames - 1}`;
}

function clampFrame(): void {
  state.frame = Math.min(state.frame, getTotalFrames() - 1);
}

function getTotalFrames(): number {
  return Math.max(1, Math.round(state.duration * state.fps));
}

function getDimensions(): { width: number; height: number } {
  const [width, height] = state.resolution.split("x").map(Number);
  return { width, height };
}

function formatTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function bindInput(id: string, onChange: (value: string) => void): void {
  const input = getElement<HTMLInputElement>(id);
  input.addEventListener("input", () => {
    onChange(input.value);
    renderCurrentFrame();
  });
}

function bindNumber(id: string, onChange: (value: number) => void): void {
  const input = getElement<HTMLInputElement>(id);
  input.addEventListener("input", () => {
    onChange(Number(input.value));
    renderCurrentFrame();
  });
}

function bindSelect(id: string, onChange: (value: string) => void): void {
  const select = getElement<HTMLSelectElement>(id);
  select.addEventListener("change", () => {
    onChange(select.value);
    renderCurrentFrame();
  });
}

function bindRange(id: string, outputId: string, onChange: (value: number) => void): void {
  const input = getElement<HTMLInputElement>(id);
  const output = getElement<HTMLOutputElement>(outputId);
  input.addEventListener("input", () => {
    const value = Number(input.value);
    output.value = value.toFixed(2);
    onChange(value);
    renderCurrentFrame();
  });
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing #${id} element.`);
  }

  return element as T;
}
