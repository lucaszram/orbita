export function stableHash(input: string): number {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function pickStable<T>(items: readonly T[], seed: string): T {
  if (items.length === 0) {
    throw new Error("Cannot pick from an empty list");
  }

  return items[stableHash(seed) % items.length];
}

export function numberInRange(seed: string, min: number, max: number): number {
  return min + (stableHash(seed) % (max - min + 1));
}
