import "./styles.css";
import type { BackgroundMode, TextEffectControl, TextEffectControlValue, TextEffectParams } from "./effects/types";
import { effects, getDefaultEffect, getEffectIndex } from "./effects/registry";
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
  fontWeight: string;
  color: string;
  seed: number;
  background: BackgroundMode;
  customByEffectId: Record<string, Record<string, TextEffectControlValue>>;
  isPlaying: boolean;
  frame: number;
}

// 默认字体栈：开源优先，最后用 web font 兜底，确保不依赖任何商用字体
// Noto Sans SC = 思源黑体（Google 发行版），与 Source Han Sans SC（Adobe 发行版）是同一套字体
const DEFAULT_FONT_STACK = '"Noto Sans SC", "Source Han Sans SC", "Noto Sans CJK SC", "OPPOSans", "PingFang SC", sans-serif';
const FONT_PRESETS = [
  { label: "默认字体栈（开源）", value: DEFAULT_FONT_STACK },
  { label: "Noto Sans SC / 思源黑体", value: '"Noto Sans SC", "Source Han Sans SC", sans-serif' },
  { label: "Source Han Sans SC（Adobe 发行版）", value: '"Source Han Sans SC", "Noto Sans SC", sans-serif' },
  { label: "OPPOSans（免费可商用）", value: '"OPPOSans", sans-serif' },
  { label: "PingFang SC（macOS 系统）", value: '"PingFang SC", sans-serif' },
];
const FONT_WEIGHTS = [
  { label: "Light / 300", value: "300" },
  { label: "Regular / 400", value: "400" },
  { label: "Medium / 500", value: "500" },
  { label: "Bold / 700", value: "700" },
  { label: "Heavy / 900", value: "900" },
];
const FONT_SCAN_CANDIDATES = [
  "Microsoft YaHei UI",
  "Microsoft YaHei",
  "DengXian",
  "SimHei",
  "SimSun",
  "KaiTi",
  "FangSong",
  "OPPOSans",
  "OPPOSans L",
  "OPPOSans R",
  "OPPOSans M",
  "OPPOSans B",
  "OPPOSans H",
  "OPPO Sans",
  "Arial",
  "Arial Unicode MS",
  "Calibri",
  "Cambria",
  "Candara",
  "Consolas",
  "Corbel",
  "Georgia",
  "Segoe UI",
  "Tahoma",
  "Times New Roman",
  "Trebuchet MS",
  "Verdana",
  "PingFang SC",
  "Hiragino Sans GB",
  "Noto Sans CJK SC",
  "Source Han Sans SC",
  "WenQuanYi Micro Hei",
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
  fontWeight: "400",
  color: "#00f6ff",
  seed: 1234,
  background: "transparent",
  customByEffectId: {},
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
              .map((effect) => {
                const index = getEffectIndex(effect.id);
                return `<option value="${escapeAttribute(effect.id)}">${index}. ${escapeHtml(effect.name)} v${escapeHtml(effect.version)}</option>`;
              })
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

        <div class="font-actions">
          <button id="scanFonts" type="button">扫描本机字体</button>
          <span id="fontStatus">优先读取系统字体，失败时检测常见字体</span>
        </div>

        <div class="inline-grid">
          <label class="control">
            <span>字号</span>
            <input id="fontSize" type="number" min="24" max="260" step="1" value="${state.fontSize}" />
          </label>
          <label class="control">
            <span>字重</span>
            <select id="fontWeight">
              ${FONT_WEIGHTS.map((weight) => `<option value="${escapeAttribute(weight.value)}">${escapeHtml(weight.label)}</option>`).join("")}
            </select>
          </label>
        </div>

        <label class="control">
          <span>主颜色</span>
          <input id="color" type="color" value="${state.color}" />
        </label>

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

        <div class="inline-grid">
          <label class="control">
            <span>随机种子</span>
            <input id="seed" type="number" step="1" value="${state.seed}" />
          </label>
        </div>

        <section id="effectControls" class="effect-controls"></section>
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
      <div class="preview-header">
        <div>
          <p class="eyebrow">LIVE PREVIEW</p>
          <h2>实时预览</h2>
        </div>
        <div id="previewMeta" class="preview-meta"></div>
      </div>

      <div class="canvas-stage">
        <div id="fontWarning" class="font-warning" hidden></div>
        <canvas id="preview" aria-label="Animation preview"></canvas>
      </div>
      <div class="transport">
        <div id="timecode" class="timecode">00:00 / 00:02</div>
        <input id="timeline" type="range" min="0" max="59" step="1" value="0" />
        <div id="frameReadout" class="progress-text">Frame 0</div>
        <div id="fontActual" class="font-actual"></div>
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
const previewMeta = getElement<HTMLDivElement>("previewMeta");
const exportProgress = getElement<HTMLProgressElement>("exportProgress");
const exportStatus = getElement<HTMLDivElement>("exportStatus");
const effectDescription = getElement<HTMLParagraphElement>("effectDescription");
const effectControls = getElement<HTMLElement>("effectControls");
const fontPreset = getElement<HTMLSelectElement>("fontPreset");
const fontWeightSelect = getElement<HTMLSelectElement>("fontWeight");
const fontStatus = getElement<HTMLSpanElement>("fontStatus");

let lastTimestamp = performance.now();
let ctx = configureCanvas(canvas, getDimensions().width, getDimensions().height);
const transparentPreviewCanvas = document.createElement("canvas");

bindControls();
updateFontWarning();
updateFontActual();
renderCurrentFrame();
requestAnimationFrame(tick);

function detectActualFont(fontFamily: string): { font: string; isFallback: boolean } {
  const fonts = fontFamily.split(",").map((f) => f.trim().replace(/^["']|["']$/g, ""));
  const genericFamilies = ["sans-serif", "serif", "monospace", "cursive", "fantasy", "system-ui"];

  const testCanvas = document.createElement("canvas");
  const testCtx = testCanvas.getContext("2d");
  if (!testCtx) return { font: fonts[0] ?? "unknown", isFallback: false };

  const testStr = "测试Test1234字体检测AB";
  const testSize = 72;

  // 完整字体栈的实际宽度
  testCtx.font = `${testSize}px ${fontFamily}`;
  const actualWidth = testCtx.measureText(testStr).width;

  // 逐一排查：哪个字体单独渲染时宽度与完整栈一致，哪个就是实际生效的
  for (const font of fonts) {
    const lower = font.toLowerCase();
    if (genericFamilies.includes(lower)) continue;

    testCtx.font = `${testSize}px "${font}"`;
    const candidateWidth = testCtx.measureText(testStr).width;

    if (Math.abs(candidateWidth - actualWidth) < 0.5) {
      return { font, isFallback: false };
    }
  }

  // 所有指定字体都没匹配上，说明在用一个泛型 fallback
  return { font: "sans-serif（系统默认）", isFallback: true };
}

function updateFontWarning(): void {
  const effectiveFamily = getEffectiveFontFamily();
  const result = detectActualFont(effectiveFamily);
  const warningEl = document.getElementById("fontWarning");

  if (!warningEl) return;

  if (!result.isFallback) {
    warningEl.setAttribute("hidden", "");
    return;
  }

  const firstFont = effectiveFamily.split(",")[0].trim().replace(/^["']|["']$/g, "");
  warningEl.removeAttribute("hidden");
  warningEl.textContent = `⚠ 字体不可用：「${firstFont}」未安装，当前显示为系统默认字体`;
}

function updateFontActual(): void {
  const effectiveFamily = getEffectiveFontFamily();
  const result = detectActualFont(effectiveFamily);
  const el = document.getElementById("fontActual");
  if (!el) return;

  const selected = effectiveFamily.split(",")[0].trim().replace(/^["']|["']$/g, "");
  if (result.isFallback) {
    el.textContent = `字体: ${result.font}（选中: ${selected}）`;
    el.classList.add("font-actual--fallback");
  } else if (result.font !== selected) {
    el.textContent = `字体: ${result.font}（选中: ${selected}）`;
    el.classList.remove("font-actual--fallback");
  } else {
    el.textContent = `字体: ${result.font}`;
    el.classList.remove("font-actual--fallback");
  }
}

function bindControls(): void {
  bindSelect("effect", (value) => {
    const nextEffect = effects.find((effect) => effect.id === value);

    if (!nextEffect) {
      return;
    }

    activeEffect = nextEffect;
    state.activeEffectId = nextEffect.id;
    effectDescription.textContent = nextEffect.description;
    ensureEffectCustomValues(nextEffect.controls);
    renderEffectControls();
  });
  bindInput("text", (value) => {
    state.text = value;
  });
  bindSelect("fontPreset", (value) => {
    state.fontFamily = value;
    updateFontWarning();
    updateFontActual();
  });
  bindSelect("fontWeight", (value) => {
    state.fontWeight = value;
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
  fontWeightSelect.value = state.fontWeight;
  getElement<HTMLButtonElement>("scanFonts").addEventListener("click", () => {
    void scanLocalFonts();
  });
  ensureEffectCustomValues(activeEffect.controls);
  renderEffectControls();
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
  const params = getRenderParams(state.frame);
  ctx = nextCtx;

  if (params.background === "transparent") {
    const transparentPreviewCtx = configureCanvas(transparentPreviewCanvas, dimensions.width, dimensions.height);
    renderFrame(transparentPreviewCtx, activeEffect, params);
    drawPreviewCheckerboard(ctx, dimensions.width, dimensions.height);
    ctx.drawImage(transparentPreviewCanvas, 0, 0);
  } else {
    renderFrame(ctx, activeEffect, params);
  }

  syncTimeline();
}

function drawPreviewCheckerboard(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const cellSize = Math.max(20, Math.round(Math.min(width, height) / 48));

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#20262e";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#131922";

  for (let y = 0; y < height; y += cellSize) {
    for (let x = 0; x < width; x += cellSize) {
      if (((x / cellSize) + (y / cellSize)) % 2 === 0) {
        ctx.fillRect(x, y, cellSize, cellSize);
      }
    }
  }
}

function getRenderParams(frame: number): TextEffectParams {
  const dimensions = getDimensions();
  const custom = getEffectCustomValues();
  return {
    text: state.text,
    frame,
    fps: state.fps,
    duration: state.duration,
    width: dimensions.width,
    height: dimensions.height,
    fontFamily: getEffectiveFontFamily(),
    fontWeight: state.fontWeight,
    fontSize: state.fontSize,
    color: state.color,
    seed: state.seed,
    intensity: getNumberCustomValue(custom, "intensity", 0.75),
    glow: getNumberCustomValue(custom, "glow", 0.6),
    scanline: getNumberCustomValue(custom, "scanline", 0.35),
    decoration: getNumberCustomValue(custom, "decoration", 0.62),
    background: state.background,
    custom,
  };
}

function renderEffectControls(): void {
  const controls = activeEffect.controls ?? [];

  if (controls.length === 0) {
    effectControls.replaceChildren();
    return;
  }

  ensureEffectCustomValues(controls);
  effectControls.innerHTML = `
    <div class="effect-controls-header">当前效果参数</div>
    ${controls.map((control) => renderControlMarkup(control)).join("")}
  `;

  for (const control of controls) {
    bindEffectControl(control);
  }
}

function renderControlMarkup(control: TextEffectControl): string {
  const value = getEffectCustomValues()[control.id] ?? control.defaultValue;
  const id = getControlElementId(control.id);

  if (control.type === "range") {
    const numericValue = Number(value);
    return `
      <label class="control">
        <span class="value-row"><span>${escapeHtml(control.label)}</span><output id="${id}Value">${formatControlNumber(numericValue)}</output></span>
        <input id="${id}" type="range" min="${control.min ?? 0}" max="${control.max ?? 1}" step="${control.step ?? 0.01}" value="${numericValue}" />
      </label>
    `;
  }

  if (control.type === "number") {
    return `
      <label class="control">
        <span>${escapeHtml(control.label)}</span>
        <input id="${id}" type="number" ${renderOptionalNumberAttribute("min", control.min)} ${renderOptionalNumberAttribute("max", control.max)} step="${control.step ?? 1}" value="${Number(value)}" />
      </label>
    `;
  }

  if (control.type === "select") {
    return `
      <label class="control">
        <span>${escapeHtml(control.label)}</span>
        <select id="${id}">
          ${control.options
            .map(
              (option) =>
                `<option value="${escapeAttribute(option.value)}" ${option.value === value ? "selected" : ""}>${escapeHtml(option.label)}</option>`,
            )
            .join("")}
        </select>
      </label>
    `;
  }

  if (control.type === "checkbox") {
    return `
      <label class="control checkbox-control">
        <span>${escapeHtml(control.label)}</span>
        <input id="${id}" type="checkbox" ${value === true ? "checked" : ""} />
      </label>
    `;
  }

  return `
    <label class="control">
      <span>${escapeHtml(control.label)}</span>
      <input id="${id}" type="${control.type === "color" ? "color" : "text"}" value="${escapeAttribute(String(value))}" />
    </label>
  `;
}

function bindEffectControl(control: TextEffectControl): void {
  const input = getElement<HTMLInputElement | HTMLSelectElement>(getControlElementId(control.id));

  input.addEventListener("input", () => {
    const custom = getEffectCustomValues();
    custom[control.id] = readControlValue(control, input);

    if (control.type === "range") {
      const output = getElement<HTMLOutputElement>(`${getControlElementId(control.id)}Value`);
      output.value = formatControlNumber(Number(custom[control.id]));
    }

    renderCurrentFrame();
  });
}

function readControlValue(control: TextEffectControl, input: HTMLInputElement | HTMLSelectElement): TextEffectControlValue {
  if (control.type === "checkbox") {
    return (input as HTMLInputElement).checked;
  }

  if (control.type === "range" || control.type === "number") {
    return Number(input.value);
  }

  return input.value;
}

function ensureEffectCustomValues(controls = activeEffect.controls): void {
  const values = getEffectCustomValues();

  for (const control of controls ?? []) {
    values[control.id] ??= control.defaultValue;
  }
}

function getEffectCustomValues(): Record<string, TextEffectControlValue> {
  state.customByEffectId[activeEffect.id] ??= {};
  return state.customByEffectId[activeEffect.id];
}

function getNumberCustomValue(
  custom: Record<string, TextEffectControlValue>,
  id: string,
  fallback: number,
): number {
  const value = custom[id];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getControlElementId(controlId: string): string {
  return `effectControl-${controlId}`;
}

function formatControlNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function renderOptionalNumberAttribute(name: string, value: number | undefined): string {
  return typeof value === "number" ? `${name}="${value}"` : "";
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
  fontStatus.textContent = "正在扫描字体...";
  let families: string[] = [];
  let scanSource = "";

  if (window.queryLocalFonts) {
    try {
      const fonts = await window.queryLocalFonts();
      families = uniqueSorted(fonts.map((font) => font.family).filter(Boolean));
      scanSource = "系统字体";
    } catch {
      families = [];
    }
  }

  if (families.length === 0) {
    families = detectInstalledFonts();
    scanSource = "常见字体";
  }

  families = uniqueSorted(families.map(normalizeFontFamilyName));
  removeSystemFontOptions();

  const appendedCount = appendSystemFontOptions(families);

  if (families.length === 0) {
    fontStatus.textContent = "当前浏览器没有返回字体，已保留预设字体。";
    return;
  }

  fontStatus.textContent =
    appendedCount > 0
      ? `已添加 ${appendedCount} 个${scanSource}。`
      : `已确认 ${families.length} 个${scanSource}，均已在预设中。`;
  syncFontPresetSelection();
  updateFontWarning();
  updateFontActual();
}

function appendSystemFontOptions(families: string[]): number {
  const existingValues = new Set(Array.from(fontPreset.options).map((option) => option.value));
  let appendedCount = 0;

  for (const family of families) {
    const value = quoteFontFamily(family);

    if (existingValues.has(value)) {
      continue;
    }

    const option = document.createElement("option");
    option.value = value;
    option.textContent = family;
    option.dataset.systemFont = "true";
    fontPreset.append(option);
    existingValues.add(value);
    appendedCount += 1;
  }

  return appendedCount;
}

function detectInstalledFonts(): string[] {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return [];
  }

  const sample = "字体检测 AaBbCc 123";
  const baseFamilies = ["monospace", "sans-serif", "serif"];
  const baseWidths = new Map<string, number>();

  for (const baseFamily of baseFamilies) {
    context.font = `72px ${baseFamily}`;
    baseWidths.set(baseFamily, context.measureText(sample).width);
  }

  return FONT_SCAN_CANDIDATES.filter((family) =>
    baseFamilies.some((baseFamily) => {
      context.font = `72px ${formatFontFamilyName(family)}, ${baseFamily}`;
      const width = context.measureText(sample).width;
      const baseWidth = baseWidths.get(baseFamily) ?? width;
      return Math.abs(width - baseWidth) > 0.1;
    }),
  );
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

function getEffectiveFontFamily(): string {
  return isOppoFontFamily(state.fontFamily) ? '"OPPOSans", sans-serif' : state.fontFamily;
}

function isOppoFontFamily(fontFamily: string): boolean {
  return fontFamily.includes("OPPOSans") || fontFamily.includes("OPPO Sans");
}

function normalizeFontFamilyName(family: string): string {
  const cleaned = family.replace(/"/g, "").trim();

  if (/^oppo\s?sans(?:\s+[lrmhb])?$/i.test(cleaned)) {
    return "OPPOSans";
  }

  return cleaned;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

function quoteFontFamily(family: string): string {
  return `${formatFontFamilyName(family)}, sans-serif`;
}

function formatFontFamilyName(family: string): string {
  const cleaned = family.replace(/"/g, "").trim();
  return cleaned.includes(" ") ? `"${cleaned}"` : cleaned;
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
  previewMeta.textContent = `${activeEffect.name} · ${state.resolution.replace("x", " × ")} · ${state.fps} FPS`;
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
