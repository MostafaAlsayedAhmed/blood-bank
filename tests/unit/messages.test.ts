import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

function keys(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

function placeholders(text: string): string[] {
  // Top-level ICU arguments such as {name} or {count, plural, ...}.
  return [...text.matchAll(/\{(\w+)\s*[,}]/g)].map((m) => m[1] ?? "").sort();
}

describe("translations", () => {
  it("Arabic and English have exactly the same keys", () => {
    expect(keys(ar).sort()).toEqual(keys(en).sort());
  });

  it("every Arabic string keeps the English placeholders", () => {
    const get = (obj: unknown, path: string) =>
      path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], obj) as string;
    for (const path of keys(en)) {
      expect(new Set(placeholders(get(ar, path))), path).toEqual(new Set(placeholders(get(en, path))));
    }
  });

  it("no Arabic value is left empty", () => {
    const empty = keys(ar).filter((path) => {
      const value = path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], ar);
      return typeof value !== "string" || value.trim() === "";
    });
    expect(empty).toEqual([]);
  });
});
