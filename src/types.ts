export interface RGBAColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export type ColorInput =
  | string
  | {
      r: number;
      g: number;
      b: number;
      a?: number;
    };

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PaintDocumentOptions {
  width: number;
  height: number;
  background?: ColorInput;
}

export interface PaintDocumentImportOptions {
  background?: ColorInput;
}

export interface PaintDocumentIO {
  open(path: string | URL): Promise<Uint8Array>;
  save(path: string | URL, bytes: Uint8Array): Promise<void>;
}

export type BrushShape = "round" | "square";

export type Anchor =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right";

export interface StretchOptions {
  scaleX: number;
  scaleY: number;
  interpolation?: "nearest";
}

export interface SkewOptions {
  xDegrees?: number;
  yDegrees?: number;
  background?: ColorInput;
}

export interface ResizeCanvasOptions {
  width: number;
  height: number;
  anchor?: Anchor;
  fill?: ColorInput;
}

export interface SelectionMaskOptions {
  bounds: Rect;
  isSelected(x: number, y: number): boolean;
}

export interface BitmapFontGlyph {
  width: number;
  height: number;
  xAdvance: number;
  rows: string[];
}

export interface BitmapFont {
  readonly name: string;
  readonly glyphWidth: number;
  readonly glyphHeight: number;
  readonly lineHeight: number;
  readonly spacing: number;
  readonly fallback: string;
  readonly glyphs: Record<string, BitmapFontGlyph>;
  resolve(char: string): BitmapFontGlyph;
}

export interface ClipboardRegion {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
}
