export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function formatYear(year: number): string {
  return String(Math.max(0, Math.floor(year))).padStart(3, "0");
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function hsl(h: number, s: number, l: number, a = 1): string {
  return a >= 1 ? `hsl(${h.toFixed(0)} ${s}% ${l}%)` : `hsl(${h.toFixed(0)} ${s}% ${l}% / ${a})`;
}

export function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}
