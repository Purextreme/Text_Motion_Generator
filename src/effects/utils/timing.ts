/**
 * 限制值在 [0, 1] 之间
 * @param value 输入值
 */
export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * 产生一个平滑的脉冲，在 progress 接近 center 时达到 1，两侧平滑衰减
 * @param progress 当前进度 0~1
 * @param center 脉冲中心点 0~1
 * @param width 脉冲影响宽度
 */
export function smoothPulse(progress: number, center: number, width: number): number {
  if (width <= 0) return progress === center ? 1 : 0;
  const dist = Math.abs(progress - center);
  if (dist >= width) return 0;
  const t = dist / width;
  // 使用平滑插值 1 - (3t^2 - 2t^3)
  return 1 - (3 * t * t - 2 * t * t * t);
}

/**
 * 在 start 到 end 的区间内产生窗口信号，前后各有 fadeRatio 比例的渐变
 * @param progress 当前进度 0~1
 * @param start 起始进度 0~1
 * @param end 结束进度 0~1
 * @param fadeRatio 两侧渐变所占区间长度的比例 (0~0.5)
 */
export function windowFade(progress: number, start: number, end: number, fadeRatio: number): number {
  if (progress < start || progress > end) return 0;
  if (start >= end) return 0;

  const len = end - start;
  const t = (progress - start) / len;

  if (fadeRatio <= 0) return 1;
  if (fadeRatio >= 0.5) {
    return Math.sin(t * Math.PI);
  }

  if (t < fadeRatio) {
    return t / fadeRatio;
  }
  if (t > 1 - fadeRatio) {
    return (1 - t) / fadeRatio;
  }
  return 1;
}

/**
 * 用于多字符的交错（stagger）进度计算
 * @param progress 整体进度 0~1
 * @param index 当前字符的索引
 * @param count 字符总数
 * @param delayRatio 每个元素的最大相对延迟 (0~1)
 */
export function staggerProgress(progress: number, index: number, count: number, delayRatio: number): number {
  if (count <= 1) return progress;
  const maxDelay = Math.min(0.95, Math.max(0, delayRatio));
  const step = count > 1 ? maxDelay / (count - 1) : 0;
  const delay = index * step;
  const activeDuration = 1 - maxDelay;
  if (activeDuration <= 0) {
    return progress >= delay ? 1 : 0;
  }
  return clamp01((progress - delay) / activeDuration);
}

/**
 * 稳定的帧随机数生成器（纯函数、无状态）
 * @param seed 基础种子
 * @param frame 当前帧
 * @param salt 扰动盐值
 */
export function frameRandom(seed: number, frame: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + frame * 78.233 + salt * 137.19) * 43758.5453123;
  return x - Math.floor(x);
}
