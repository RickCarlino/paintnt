import type { Rect, SelectionMaskOptions } from "./types.js";
import { intersectRect, normalizeRect, rectFromSize } from "./utils.js";
import type { PaintDocument } from "./document.js";

class ActiveSelection {
  readonly bounds: Rect;
  private readonly mask: Uint8Array;

  constructor(bounds: Rect, mask: Uint8Array) {
    this.bounds = bounds;
    this.mask = mask;
  }

  contains(x: number, y: number): boolean {
    if (
      x < this.bounds.x ||
      y < this.bounds.y ||
      x >= this.bounds.x + this.bounds.width ||
      y >= this.bounds.y + this.bounds.height
    ) {
      return false;
    }

    const localX = x - this.bounds.x;
    const localY = y - this.bounds.y;
    return this.mask[localY * this.bounds.width + localX] === 1;
  }

  cloneMask(): Uint8Array {
    return new Uint8Array(this.mask);
  }
}

export class SelectionManager {
  private active: ActiveSelection | null = null;

  constructor(private readonly doc: PaintDocument) {}

  setRectangle(rect: Rect): void {
    const clipped = this.clipToCanvas(normalizeRect(rect));

    if (!clipped) {
      this.clear();
      return;
    }

    const mask = new Uint8Array(clipped.width * clipped.height);
    mask.fill(1);
    this.active = new ActiveSelection(clipped, mask);
  }

  setMask(options: SelectionMaskOptions): void {
    const clipped = this.clipToCanvas(normalizeRect(options.bounds));

    if (!clipped) {
      this.clear();
      return;
    }

    const mask = new Uint8Array(clipped.width * clipped.height);
    let selectedCount = 0;

    for (let y = 0; y < clipped.height; y += 1) {
      for (let x = 0; x < clipped.width; x += 1) {
        const globalX = clipped.x + x;
        const globalY = clipped.y + y;
        const selected = options.isSelected(globalX, globalY);
        mask[y * clipped.width + x] = selected ? 1 : 0;
        selectedCount += selected ? 1 : 0;
      }
    }

    if (selectedCount === 0) {
      this.clear();
      return;
    }

    this.active = new ActiveSelection(clipped, mask);
  }

  selectAll(): void {
    this.setRectangle({
      x: 0,
      y: 0,
      width: this.doc.bitmap.width,
      height: this.doc.bitmap.height,
    });
  }

  clear(): void {
    this.active = null;
  }

  hasSelection(): boolean {
    return this.active !== null;
  }

  contains(x: number, y: number): boolean {
    if (!this.doc.bitmap.inBounds(x, y)) {
      return false;
    }

    return this.active ? this.active.contains(x, y) : true;
  }

  bounds(): Rect {
    return this.active?.bounds ?? rectFromSize(this.doc.bitmap.width, this.doc.bitmap.height);
  }

  activeBounds(): Rect | null {
    return this.active?.bounds ?? null;
  }

  forEachSelected(callback: (x: number, y: number) => void): void {
    if (!this.active) {
      for (let y = 0; y < this.doc.bitmap.height; y += 1) {
        for (let x = 0; x < this.doc.bitmap.width; x += 1) {
          callback(x, y);
        }
      }

      return;
    }

    for (let y = this.active.bounds.y; y < this.active.bounds.y + this.active.bounds.height; y += 1) {
      for (
        let x = this.active.bounds.x;
        x < this.active.bounds.x + this.active.bounds.width;
        x += 1
      ) {
        if (this.active.contains(x, y)) {
          callback(x, y);
        }
      }
    }
  }

  replace(bounds: Rect, mask?: Uint8Array): void {
    const clipped = this.clipToCanvas(normalizeRect(bounds));

    if (!clipped) {
      this.clear();
      return;
    }

    if (!mask) {
      this.setRectangle(clipped);
      return;
    }

    if (mask.length !== clipped.width * clipped.height) {
      throw new Error("Selection mask size does not match bounds");
    }

    if (!mask.some((value) => value === 1)) {
      this.clear();
      return;
    }

    this.active = new ActiveSelection(clipped, new Uint8Array(mask));
  }

  cloneMask(): Uint8Array | null {
    return this.active?.cloneMask() ?? null;
  }

  private clipToCanvas(rect: Rect): Rect | null {
    return intersectRect(rect, rectFromSize(this.doc.bitmap.width, this.doc.bitmap.height));
  }
}
