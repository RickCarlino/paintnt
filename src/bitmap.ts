import type { ColorInput, Rect, RGBAColor } from "./types.ts";
import { parseColor } from "./colors.ts";
import { clamp } from "./utils.ts";

function compositeChannel(source: number, destination: number, alpha: number): number {
  return Math.round(source * alpha + destination * (1 - alpha));
}

export class Bitmap {
  readonly width: number;
  readonly height: number;
  private readonly pixels: Uint8ClampedArray;

  constructor(width: number, height: number, fill?: ColorInput, pixels?: Uint8ClampedArray) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
      throw new Error("Bitmap dimensions must be positive integers");
    }

    this.width = width;
    this.height = height;
    this.pixels = pixels ?? new Uint8ClampedArray(width * height * 4);

    if (this.pixels.length !== width * height * 4) {
      throw new Error("Bitmap pixel buffer length does not match dimensions");
    }

    if (pixels) {
      if (fill !== undefined) {
        this.fill(fill);
      }
    } else {
      this.fill(fill ?? ColorsTransparent);
    }
  }

  static fromRGBA(width: number, height: number, rgba: Uint8Array | Uint8ClampedArray): Bitmap {
    return new Bitmap(width, height, undefined, new Uint8ClampedArray(rgba));
  }

  clone(): Bitmap {
    return new Bitmap(this.width, this.height, undefined, new Uint8ClampedArray(this.pixels));
  }

  toRGBA(): Uint8Array {
    return new Uint8Array(this.pixels);
  }

  getPixel(x: number, y: number): RGBAColor {
    if (!this.inBounds(x, y)) {
      return { r: 0, g: 0, b: 0, a: 0 };
    }

    const offset = this.index(x, y);

    return {
      r: this.pixels[offset],
      g: this.pixels[offset + 1],
      b: this.pixels[offset + 2],
      a: this.pixels[offset + 3],
    };
  }

  setPixel(x: number, y: number, color: ColorInput | RGBAColor): void {
    if (!this.inBounds(x, y)) {
      return;
    }

    const resolved = isRGBA(color) ? color : parseColor(color);
    const offset = this.index(x, y);
    this.pixels[offset] = resolved.r;
    this.pixels[offset + 1] = resolved.g;
    this.pixels[offset + 2] = resolved.b;
    this.pixels[offset + 3] = resolved.a;
  }

  drawPixel(x: number, y: number, color: ColorInput | RGBAColor): void {
    if (!this.inBounds(x, y)) {
      return;
    }

    const source = isRGBA(color) ? color : parseColor(color);

    if (source.a === 255) {
      this.setPixel(x, y, source);
      return;
    }

    if (source.a === 0) {
      return;
    }

    const offset = this.index(x, y);
    const destination = {
      r: this.pixels[offset],
      g: this.pixels[offset + 1],
      b: this.pixels[offset + 2],
      a: this.pixels[offset + 3],
    };

    const sourceAlpha = source.a / 255;
    const destinationAlpha = destination.a / 255;
    const outAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);

    if (outAlpha <= 0) {
      this.setPixel(x, y, { r: 0, g: 0, b: 0, a: 0 });
      return;
    }

    this.pixels[offset] = compositeChannel(
      source.r,
      destination.r,
      sourceAlpha / outAlpha,
    );
    this.pixels[offset + 1] = compositeChannel(
      source.g,
      destination.g,
      sourceAlpha / outAlpha,
    );
    this.pixels[offset + 2] = compositeChannel(
      source.b,
      destination.b,
      sourceAlpha / outAlpha,
    );
    this.pixels[offset + 3] = clamp(Math.round(outAlpha * 255), 0, 255);
  }

  fill(color: ColorInput | RGBAColor): void {
    const resolved = isRGBA(color) ? color : parseColor(color);

    for (let offset = 0; offset < this.pixels.length; offset += 4) {
      this.pixels[offset] = resolved.r;
      this.pixels[offset + 1] = resolved.g;
      this.pixels[offset + 2] = resolved.b;
      this.pixels[offset + 3] = resolved.a;
    }
  }

  copyRect(rect: Rect): Bitmap {
    const next = new Bitmap(rect.width, rect.height);

    for (let y = 0; y < rect.height; y += 1) {
      for (let x = 0; x < rect.width; x += 1) {
        next.setPixel(x, y, this.getPixel(rect.x + x, rect.y + y));
      }
    }

    return next;
  }

  blit(source: Bitmap, targetX: number, targetY: number, transparent = false): void {
    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        const color = source.getPixel(x, y);

        if (transparent && color.a === 0) {
          continue;
        }

        this.setPixel(targetX + x, targetY + y, color);
      }
    }
  }

  clearRect(rect: Rect, color: ColorInput | RGBAColor): void {
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        this.setPixel(x, y, color);
      }
    }
  }

  forEachPixel(callback: (x: number, y: number, color: RGBAColor) => void): void {
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        callback(x, y, this.getPixel(x, y));
      }
    }
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  private index(x: number, y: number): number {
    return (y * this.width + x) * 4;
  }
}

const ColorsTransparent = { r: 0, g: 0, b: 0, a: 0 } as const;

function isRGBA(value: unknown): value is RGBAColor {
  return (
    typeof value === "object" &&
    value !== null &&
    "r" in value &&
    "g" in value &&
    "b" in value &&
    "a" in value
  );
}
