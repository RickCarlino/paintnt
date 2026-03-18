import type { ClipboardRegion, ColorInput, Rect } from "./types.js";
import { parseColor } from "./colors.js";
import { intersectRect, normalizeRect, rectFromSize } from "./utils.js";
import type { PaintDocument } from "./document.js";

export class EditManager {
  constructor(private readonly doc: PaintDocument) {}

  copy(rect?: Rect): ClipboardRegion {
    const region = this.resolveRegion(rect);

    if (!region) {
      return { width: 0, height: 0, pixels: new Uint8ClampedArray(0) };
    }

    const pixels = new Uint8ClampedArray(region.width * region.height * 4);
    const selectionAware = rect === undefined && this.doc.selection.hasSelection();

    for (let y = 0; y < region.height; y += 1) {
      for (let x = 0; x < region.width; x += 1) {
        const globalX = region.x + x;
        const globalY = region.y + y;

        if (selectionAware && !this.doc.selection.contains(globalX, globalY)) {
          continue;
        }

        const color = this.doc.bitmap.getPixel(globalX, globalY);
        const offset = (y * region.width + x) * 4;
        pixels[offset] = color.r;
        pixels[offset + 1] = color.g;
        pixels[offset + 2] = color.b;
        pixels[offset + 3] = color.a;
      }
    }

    return {
      width: region.width,
      height: region.height,
      pixels,
    };
  }

  cut(rect?: Rect): ClipboardRegion {
    const clip = this.copy(rect);

    if (clip.width === 0 || clip.height === 0) {
      return clip;
    }

    if (rect) {
      const clipped = this.resolveRegion(rect);

      if (clipped) {
        this.doc.clearRawRect(clipped, this.doc.state.backgroundColor());
      }
    } else {
      this.clear({ color: this.doc.state.backgroundColor() });
    }

    return clip;
  }

  paste(
    clip: ClipboardRegion,
    options: { x: number; y: number; transparent?: boolean },
  ): void {
    const transparent = options.transparent ?? this.doc.state.transparentPaste();

    for (let y = 0; y < clip.height; y += 1) {
      for (let x = 0; x < clip.width; x += 1) {
        const offset = (y * clip.width + x) * 4;
        const color = {
          r: clip.pixels[offset],
          g: clip.pixels[offset + 1],
          b: clip.pixels[offset + 2],
          a: clip.pixels[offset + 3],
        };

        if (transparent && color.a === 0) {
          continue;
        }

        this.doc.setPixel(options.x + x, options.y + y, color);
      }
    }
  }

  clear(options?: { color?: ColorInput }): void {
    const color = parseColor(options?.color ?? this.doc.state.backgroundColor());

    if (!this.doc.selection.hasSelection()) {
      this.doc.bitmap.fill(color);
      return;
    }

    this.doc.selection.forEachSelected((x, y) => {
      this.doc.setPixelRaw(x, y, color);
    });
  }

  private resolveRegion(rect?: Rect): Rect | null {
    if (rect) {
      return intersectRect(
        normalizeRect(rect),
        rectFromSize(this.doc.bitmap.width, this.doc.bitmap.height),
      );
    }

    if (this.doc.selection.hasSelection()) {
      return this.doc.selection.bounds();
    }

    return rectFromSize(this.doc.bitmap.width, this.doc.bitmap.height);
  }
}
