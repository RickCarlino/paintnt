import { Bitmap } from "./bitmap.ts";
import { parseColor } from "./colors.ts";
import type { ColorInput, Point, Rect, ResizeCanvasOptions, SkewOptions, StretchOptions } from "./types.ts";
import {
  anchorOffset,
  nearlyZero,
  rectFromSize,
  rotatePointClockwise180,
  rotatePointClockwise270,
  rotatePointClockwise90,
} from "./utils.ts";
import type { PaintDocument } from "./document.ts";

interface TargetRegion {
  origin: Point;
  bitmap: Bitmap;
  selectionActive: boolean;
}

export class ImageManager {
  constructor(private readonly doc: PaintDocument) {}

  invert(): void {
    const pixels: Array<[number, number]> = [];
    this.doc.selection.forEachSelected((x, y) => {
      pixels.push([x, y]);
    });

    for (const [x, y] of pixels) {
      const color = this.doc.bitmap.getPixel(x, y);
      this.doc.setPixelRaw(x, y, {
        r: 255 - color.r,
        g: 255 - color.g,
        b: 255 - color.b,
        a: color.a,
      });
    }
  }

  flipHorizontal(): void {
    this.applyBitmapTransform((bitmap) => flipBitmap(bitmap, "horizontal"));
  }

  flipVertical(): void {
    this.applyBitmapTransform((bitmap) => flipBitmap(bitmap, "vertical"));
  }

  rotate(angle: 90 | 180 | 270): void {
    if (![90, 180, 270].includes(angle)) {
      throw new Error("Rotate angle must be 90, 180, or 270");
    }

    this.applyBitmapTransform((bitmap) => rotateBitmap(bitmap, angle));
  }

  stretch(options: StretchOptions): void {
    if (options.interpolation && options.interpolation !== "nearest") {
      throw new Error(`Unsupported interpolation: ${options.interpolation}`);
    }

    if (options.scaleX <= 0 || options.scaleY <= 0) {
      throw new Error("Stretch scale must be greater than 0");
    }

    this.applyBitmapTransform((bitmap) =>
      scaleBitmap(bitmap, options.scaleX, options.scaleY),
    );
  }

  skew(options: SkewOptions): void {
    const background = parseColor(options.background ?? this.doc.state.backgroundColor());
    this.applyBitmapTransform((bitmap) =>
      skewBitmap(bitmap, options.xDegrees ?? 0, options.yDegrees ?? 0, background),
    );
  }

  resizeCanvas(options: ResizeCanvasOptions): void {
    if (!Number.isInteger(options.width) || !Number.isInteger(options.height)) {
      throw new Error("Canvas dimensions must be integers");
    }

    if (options.width <= 0 || options.height <= 0) {
      throw new Error("Canvas dimensions must be greater than 0");
    }

    const fill = parseColor(options.fill ?? this.doc.state.backgroundColor());
    const next = new Bitmap(options.width, options.height, fill);
    const offset = anchorOffset(
      options.anchor ?? "top-left",
      options.width,
      options.height,
      this.doc.bitmap.width,
      this.doc.bitmap.height,
    );
    next.blit(this.doc.bitmap, offset.x, offset.y, true);
    this.doc.replaceBitmap(next);
  }

  getAttributes(): { width: number; height: number } {
    return {
      width: this.doc.bitmap.width,
      height: this.doc.bitmap.height,
    };
  }

  private applyBitmapTransform(transform: (bitmap: Bitmap) => Bitmap): void {
    const target = this.extractTarget();
    const result = transform(target.bitmap);

    if (!target.selectionActive) {
      this.doc.replaceBitmap(result);
      return;
    }

    this.doc.clearSelectionPixels(this.doc.state.backgroundColor());
    this.doc.selection.clear();

    for (let y = 0; y < result.height; y += 1) {
      for (let x = 0; x < result.width; x += 1) {
        const color = result.getPixel(x, y);

        if (color.a === 0) {
          continue;
        }

        this.doc.setPixelRaw(target.origin.x + x, target.origin.y + y, color);
      }
    }

    this.doc.selection.setRectangle({
      x: target.origin.x,
      y: target.origin.y,
      width: result.width,
      height: result.height,
    });
  }

  private extractTarget(): TargetRegion {
    if (!this.doc.selection.hasSelection()) {
      return {
        origin: { x: 0, y: 0 },
        bitmap: this.doc.bitmap.clone(),
        selectionActive: false,
      };
    }

    const bounds = this.doc.selection.bounds();
    const bitmap = new Bitmap(bounds.width, bounds.height);

    for (let y = 0; y < bounds.height; y += 1) {
      for (let x = 0; x < bounds.width; x += 1) {
        const globalX = bounds.x + x;
        const globalY = bounds.y + y;

        if (!this.doc.selection.contains(globalX, globalY)) {
          continue;
        }

        bitmap.setPixel(x, y, this.doc.bitmap.getPixel(globalX, globalY));
      }
    }

    return {
      origin: { x: bounds.x, y: bounds.y },
      bitmap,
      selectionActive: true,
    };
  }
}

function flipBitmap(bitmap: Bitmap, direction: "horizontal" | "vertical"): Bitmap {
  const next = new Bitmap(bitmap.width, bitmap.height);

  for (let y = 0; y < bitmap.height; y += 1) {
    for (let x = 0; x < bitmap.width; x += 1) {
      const targetX = direction === "horizontal" ? bitmap.width - 1 - x : x;
      const targetY = direction === "vertical" ? bitmap.height - 1 - y : y;
      next.setPixel(targetX, targetY, bitmap.getPixel(x, y));
    }
  }

  return next;
}

function rotateBitmap(bitmap: Bitmap, angle: 90 | 180 | 270): Bitmap {
  if (angle === 180) {
    const next = new Bitmap(bitmap.width, bitmap.height);

    for (let y = 0; y < bitmap.height; y += 1) {
      for (let x = 0; x < bitmap.width; x += 1) {
        const point = rotatePointClockwise180({ x, y }, bitmap.width, bitmap.height);
        next.setPixel(point.x, point.y, bitmap.getPixel(x, y));
      }
    }

    return next;
  }

  const next = new Bitmap(bitmap.height, bitmap.width);

  for (let y = 0; y < bitmap.height; y += 1) {
    for (let x = 0; x < bitmap.width; x += 1) {
      const point =
        angle === 90
          ? rotatePointClockwise90({ x, y }, bitmap.width, bitmap.height)
          : rotatePointClockwise270({ x, y }, bitmap.width, bitmap.height);
      next.setPixel(point.x, point.y, bitmap.getPixel(x, y));
    }
  }

  return next;
}

function scaleBitmap(bitmap: Bitmap, scaleX: number, scaleY: number): Bitmap {
  const width = Math.max(1, Math.round(bitmap.width * scaleX));
  const height = Math.max(1, Math.round(bitmap.height * scaleY));
  const next = new Bitmap(width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(bitmap.width - 1, Math.floor(x / scaleX));
      const sourceY = Math.min(bitmap.height - 1, Math.floor(y / scaleY));
      next.setPixel(x, y, bitmap.getPixel(sourceX, sourceY));
    }
  }

  return next;
}

function skewBitmap(bitmap: Bitmap, xDegrees: number, yDegrees: number, background: ColorInput) {
  const tanX = Math.tan((xDegrees * Math.PI) / 180);
  const tanY = Math.tan((yDegrees * Math.PI) / 180);
  const determinant = 1 - tanX * tanY;

  if (nearlyZero(determinant)) {
    throw new Error("Skew transform is singular for these angles");
  }

  const corners = [
    transformPoint(0, 0, tanX, tanY),
    transformPoint(bitmap.width - 1, 0, tanX, tanY),
    transformPoint(0, bitmap.height - 1, tanX, tanY),
    transformPoint(bitmap.width - 1, bitmap.height - 1, tanX, tanY),
  ];
  const minX = Math.floor(Math.min(...corners.map((point) => point.x)));
  const maxX = Math.ceil(Math.max(...corners.map((point) => point.x)));
  const minY = Math.floor(Math.min(...corners.map((point) => point.y)));
  const maxY = Math.ceil(Math.max(...corners.map((point) => point.y)));
  const next = new Bitmap(maxX - minX + 1, maxY - minY + 1, background);

  for (let y = 0; y < next.height; y += 1) {
    for (let x = 0; x < next.width; x += 1) {
      const transformedX = x + minX;
      const transformedY = y + minY;
      const sourceX = (transformedX - tanX * transformedY) / determinant;
      const sourceY = (transformedY - tanY * transformedX) / determinant;
      const roundedX = Math.round(sourceX);
      const roundedY = Math.round(sourceY);

      if (!bitmap.inBounds(roundedX, roundedY)) {
        continue;
      }

      next.setPixel(x, y, bitmap.getPixel(roundedX, roundedY));
    }
  }

  return next;
}

function transformPoint(x: number, y: number, tanX: number, tanY: number): Point {
  return {
    x: x + tanX * y,
    y: y + tanY * x,
  };
}
