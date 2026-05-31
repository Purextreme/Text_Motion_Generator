export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function randomFromSeed(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededValue(seed: number, salt: string): number {
  return randomFromSeed((seed ^ hashString(salt)) >>> 0)();
}

export function pickSeeded<T>(items: T[], seed: number, salt: string): T {
  const index = Math.floor(seededValue(seed, salt) * items.length) % items.length;
  return items[index];
}
