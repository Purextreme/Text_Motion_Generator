import "./styles.css";
import type { BackgroundMode, TextEffectParams } from "./effects/types";
import { effects, getDefaultEffect } from "./effects/registry";
import { configureCanvas, renderFrame } from "./renderer/canvasRenderer";
import { exportPngSequenceZip } from "./renderer/exportPngSequence";

interface LocalFontData {
  family: string;
  fullName: string;
  postscriptName: string;
  style: string;
}

declare global {
  interface Window {
    queryLocalFonts?: () => Promise<LocalFontData[]>;
  }
}

interface AppState {
  text: string;
  activeEffectId: string;
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
  decoration: number;
  background: BackgroundMode;
  isPlaying: boolean;
  frame: number;
}

const DEFAULT_FONT_STACK = '"Microsoft YaHei UI", "PingFang SC", "Noto Sans CJK SC", "Source Han Sans SC", sans-serif';
const FONT_PRESETS = [
  { label: "中文默认字体栈", value: DEFAULT_FONT_STACK },
  { label: "Microsoft YaHei UI", value: '"Microsoft YaHei UI", sans-serif' },
  { label: "Microsoft YaHei", value: '"Microsoft YaHei", sans-serif' },
  { label: "SimHei", value: "SimHei, sans-serif" },
  { label: "SimSun", value: "SimSun, serif" },
  { label: "PingFang SC", value: '"PingFang SC", sans-serif' },
  { label: "Noto Sans CJK SC", value: '"Noto Sans CJK SC", sans-serif' },
  { label: "Source Han Sans SC", value: '"Source Han Sans SC", sans-serif' },
];

let activeEffect = getDefaultEffect();

const state: AppState = {
  text: "系统已上线",
  activeEffectId: activeEffect.id,
  resolution: "1920x1080",
  fps: 30,
  duration: 2,
  fontSize: 96,
  fontFamily: DEFAULT_FONT_STACK,
  color: "#00f6ff",
  seed: 1234,
  intensity: 0.75,
  glow: 0.6,
  scanline: 0.35,
  decoration: 0.62,
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
        <p class="eyebrow">中文文字动效序列帧</p>
        <h1>文字动效</h1>
        <p id="effectDescription" class="effect-name">${escapeHtml(activeEffect.description)}</p>
      </section>

      <section class="control-grid">
        <label class="control">
          <span>效果模板</span>
          <select id="effect">
            ${effects
              .map((effect) => `<option value="${escapeAttribute(effect.id)}">${escapeHtml(effect.name)} v${escapeHtml(effect.version)}</option>`)
              .join("")}
          </select>
        </label>

        <label class="control">
          <span>文字内容</span>
          <input id="text" type="text" value="${escapeAttribute(state.text)}" />
        </label>

        <label class="control">
          <span>字体预设 / 系统字体</span>
          <select id="fontPreset">
            ${FONT_PRESETS.map((font) => `<option value="${escapeAttribute(font.value)}">${escapeHtml(font.label)}</option>`).join("")}
          </select>
        </label>

        <label class="control">
          <span>font-family 手动输入</span>
          <input id="fontFamily" type="text" value="${escapeAttribute(state.fontFamily)}" />
        </label>

        <div class="font-actions">
          <button id="scanFonts" type="button">扫描本机字体</button>
          <span id="fontStatus">浏览器允许时可读取系统字体</span>
        </div>

        <div class="inline-grid">
          <label class="control">
            <span>字号</span>
            <input id="fontSize" type="number" min="24" max="260" step="1" value="${state.fontSize}" />
          </label>
          <label class="control">
            <span>主颜色</span>
            <input id="color" type="color" value="${state.color}" />
          </label>
        </div>

        <div class="inline-grid">
          <label class="control">
            <span>背景</span>
            <select id="background">
              <option value="transparent">transparent</option>
              <option value="black">black</option>
              <option value="dark-blue">dark blue</option>
            </select>
          </label>
          <label class="control">
            <span>分辨率</span>
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
            <span>时长</span>
            <input id="duration" type="number" min="0.25" max="10" step="0.25" value="${state.duration}" />
          </label>
        </div>

        <label class="control">
          <span>随机种子</span>
          <input id="seed" type="number" step="1" value="${state.seed}" />
        </label>

        <label class="control">
          <span class="value-row"><span>故障强度</span><output id="intensityValue">${state.intensity.toFixed(2)}</output></span>
          <input id="intensity" type="range" min="0" max="1" step="0.01" value="${state.intensity}" />
        </label>

        <label class="control">
          <span class="value-row"><span>发光</span><output id="glowValue">${state.glow.toFixed(2)}</output></span>
          <input id="glow" type="range" min="0" max="1" step="0.01" value="${state.glow}" />
        </label>

        <label class="control">
          <span class="value-row"><span>扫描线</span><output id="scanlineValue">${state.scanline.toFixed(2)}</output></span>
          <input id="scanline" type="range" min="0" max="1" step="0.01" value="${state.scanline}" />
        </label>

        <label class="control">
          <span class="value-row"><span>文字周边装饰</span><output id="decorationValue">${state.decoration.toFixed(2)}</output></span>
          <input id="decoration" type="range" min="0" max="1" step="0.01" value="${state.decoration}" />
        </label>
      </section>

      <section class="button-row">
        <button id="playPause" type="button">暂停</button>
        <button id="export" type="button" class="export-button">导出 PNG ZIP</button>
      </section>

      <div class="progress-wrap">
        <progress id="exportProgress" value="0" max="1"></progress>
        <div id="exportStatus" class="progress-text">就绪</div>
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
const effectDescription = getElement<HTMLParagraphElement>("effectDescription");
const fontPreset = getElement<HTMLSelectElement>("fontPreset");
const fontFamilyInput = getElement<HTMLInputElement>("fontFamily");
const fontStatus = getElement<HTMLSpanElement>("fontStatus");

let lastTimestamp = performance.now();
let ctx = configureCanvas(canvas, getDimensions().width, getDimensions().height);

bindControls();
renderCurrentFrame();
requestAnimationFrame(tick);

function bindControls(): void {
  bindSelect("effect", (value) => {
    const nextEffect = effects.find((effect) => effect.id === value);

    if (!nextEffect) {
      return;
    }

    activeEffect = nextEffect;
    state.activeEffectId = nextEffect.id;
    effectDescription.textContent = nextEffect.description;
  });
  bindInput("text", (value) => {
    state.text = value;
  });
  bindInput("fontFamily", (value) => {
    state.fontFamily = value.trim() || "sans-serif";
    syncFontPresetSelection();
  });
  bindSelect("fontPreset", (value) => {
    state.fontFamily = value;
    fontFamilyInput.value = value;
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
  bindRange("decoration", "decorationValue", (value) => {
    state.decoration = value;
  });

  playPauseButton.addEventListener("click", () => {
    state.isPlaying = !state.isPlaying;
    playPauseButton.textContent = state.isPlaying ? "暂停" : "播放";
    lastTimestamp = performance.now();
  });

  timeline.addEventListener("input", () => {
    state.frame = Number(timeline.value);
    state.isPlaying = false;
    playPauseButton.textContent = "播放";
    renderCurrentFrame();
  });

  exportButton.addEventListener("click", () => {
    void exportSequence();
  });

  getElement<HTMLSelectElement>("effect").value = state.activeEffectId;
  getElement<HTMLSelectElement>("background").value = state.background;
  getElement<HTMLSelectElement>("resolution").value = state.resolution;
  getElement<HTMLSelectElement>("fps").value = String(state.fps);
  getElement<HTMLButtonElement>("scanFonts").addEventListener("click", () => {
    void scanLocalFonts();
  });
  syncFontPresetSelection();
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
    decoration: state.decoration,
    background: state.background,
  };
}

async function exportSequence(): Promise<void> {
  exportButton.disabled = true;
  exportProgress.value = 0;
  exportStatus.textContent = "正在渲染帧...";

  try {
    const blob = await exportPngSequenceZip(activeEffect, getRenderParams(0), (progress) => {
      exportProgress.value = progress.current / progress.total;
      exportStatus.textContent =
        progress.phase === "zipping"
          ? `正在打包 ${Math.round((progress.current / progress.total) * 100)}%`
          : `正在渲染 ${progress.current} / ${progress.total}`;
    });

    downloadBlob(blob, `text_anim_${state.resolution}_${state.fps}fps.zip`);
    exportStatus.textContent = "导出完成";
  } catch (error) {
    exportStatus.textContent = error instanceof Error ? error.message : "导出失败";
  } finally {
    exportButton.disabled = false;
  }
}

async function scanLocalFonts(): Promise<void> {
  if (!window.queryLocalFonts) {
    fontStatus.textContent = "当前浏览器不支持系统字体扫描，请使用预设或手动输入。";
    return;
  }

  fontStatus.textContent = "正在请求字体权限...";

  try {
    const fonts = await window.queryLocalFonts();
    const families = [...new Set(fonts.map((font) => font.family).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "zh-Hans-CN"),
    );

    removeSystemFontOptions();

    for (const family of families) {
      const option = document.createElement("option");
      option.value = quoteFontFamily(family);
      option.textContent = family;
      option.dataset.systemFont = "true";
      fontPreset.append(option);
    }

    fontStatus.textContent = `已读取 ${families.length} 个字体家族。`;
    syncFontPresetSelection();
  } catch {
    fontStatus.textContent = "未获得字体权限，请使用预设或手动输入。";
  }
}

function removeSystemFontOptions(): void {
  for (const option of Array.from(fontPreset.options)) {
    if (option.dataset.systemFont === "true") {
      option.remove();
    }
  }
}

function syncFontPresetSelection(): void {
  const matchingOption = Array.from(fontPreset.options).find((option) => option.value === state.fontFamily);
  fontPreset.value = matchingOption ? matchingOption.value : "";
}

function quoteFontFamily(family: string): string {
  const cleaned = family.replace(/"/g, "").trim();
  return cleaned.includes(" ") ? `"${cleaned}", sans-serif` : `${cleaned}, sans-serif`;
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

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
