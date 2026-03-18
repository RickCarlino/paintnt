import type { ColorInput, RGBAColor } from "./types.ts";
import { clampByte } from "./utils.ts";

const NAMED_COLORS: Record<string, RGBAColor> = {
  black: { r: 0, g: 0, b: 0, a: 255 },
  white: { r: 255, g: 255, b: 255, a: 255 },
  red: { r: 255, g: 0, b: 0, a: 255 },
  green: { r: 0, g: 128, b: 0, a: 255 },
  blue: { r: 0, g: 0, b: 255, a: 255 },
  yellow: { r: 255, g: 255, b: 0, a: 255 },
  cyan: { r: 0, g: 255, b: 255, a: 255 },
  magenta: { r: 255, g: 0, b: 255, a: 255 },
  gray: { r: 128, g: 128, b: 128, a: 255 },
  grey: { r: 128, g: 128, b: 128, a: 255 },
  transparent: { r: 0, g: 0, b: 0, a: 0 },
};

function fromHex(hex: string): RGBAColor {
  const trimmed = hex.replace(/^#/, "");

  if (![3, 4, 6, 8].includes(trimmed.length)) {
    throw new Error(`Unsupported hex color: ${hex}`);
  }

  if (!/^[0-9a-f]+$/i.test(trimmed)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }

  if (trimmed.length === 3 || trimmed.length === 4) {
    const [r, g, b, a = "f"] = trimmed.split("");

    return {
      r: parseInt(r + r, 16),
      g: parseInt(g + g, 16),
      b: parseInt(b + b, 16),
      a: parseInt(a + a, 16),
    };
  }

  return {
    r: parseInt(trimmed.slice(0, 2), 16),
    g: parseInt(trimmed.slice(2, 4), 16),
    b: parseInt(trimmed.slice(4, 6), 16),
    a: trimmed.length === 8 ? parseInt(trimmed.slice(6, 8), 16) : 255,
  };
}

export function parseColor(input: ColorInput): RGBAColor {
  if (typeof input === "string") {
    const normalized = input.trim().toLowerCase();

    if (normalized.startsWith("#")) {
      return fromHex(normalized);
    }

    const named = NAMED_COLORS[normalized];

    if (!named) {
      throw new Error(`Unknown color: ${input}`);
    }

    return { ...named };
  }

  if (
    typeof input.r !== "number" ||
    typeof input.g !== "number" ||
    typeof input.b !== "number"
  ) {
    throw new Error("Invalid RGBA color");
  }

  return {
    r: clampByte(input.r),
    g: clampByte(input.g),
    b: clampByte(input.b),
    a: clampByte(input.a ?? 255),
  };
}

function namedColor(name: keyof typeof NAMED_COLORS): RGBAColor {
  return { ...NAMED_COLORS[name] };
}

export const Colors = {
  parse: parseColor,
  transparent: () => namedColor("transparent"),
  black: () => namedColor("black"),
  white: () => namedColor("white"),
  red: () => namedColor("red"),
  green: () => namedColor("green"),
  blue: () => namedColor("blue"),
  yellow: () => namedColor("yellow"),
  cyan: () => namedColor("cyan"),
  magenta: () => namedColor("magenta"),
  gray: () => namedColor("gray"),
  grey: () => namedColor("grey"),
} as const;
