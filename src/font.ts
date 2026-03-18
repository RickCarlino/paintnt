import type { BitmapFont, BitmapFontGlyph } from "./types.js";
import { DEFAULT_BITMAP_FONT } from "./generated/default-font.js";

export function createBitmapFont(options: {
  name: string;
  glyphWidth: number;
  glyphHeight: number;
  lineHeight?: number;
  spacing?: number;
  fallback?: string;
  glyphs: Record<string, BitmapFontGlyph>;
}): BitmapFont {
  const fallback = options.fallback ?? "?";

  return {
    name: options.name,
    glyphWidth: options.glyphWidth,
    glyphHeight: options.glyphHeight,
    lineHeight: options.lineHeight ?? options.glyphHeight + 1,
    spacing: options.spacing ?? 1,
    fallback,
    glyphs: options.glyphs,
    resolve(char: string): BitmapFontGlyph {
      return options.glyphs[char] ?? options.glyphs[fallback];
    },
  };
}

export { DEFAULT_BITMAP_FONT };
