import type { BrushShape, ColorInput, RGBAColor } from "./types.ts";
import { parseColor } from "./colors.ts";

export class PaintState {
  private currentColorValue: RGBAColor;
  private fillColorValue: RGBAColor;
  private backgroundColorValue: RGBAColor;
  private brushSizeValue = 1;
  private brushShapeValue: BrushShape = "round";
  private transparentPasteValue = false;

  constructor(background: ColorInput) {
    const backgroundColor = parseColor(background);
    this.currentColorValue = parseColor("#000000");
    this.fillColorValue = backgroundColor;
    this.backgroundColorValue = backgroundColor;
  }

  setColor(color: ColorInput): void {
    this.currentColorValue = parseColor(color);
  }

  setFillColor(color: ColorInput): void {
    this.fillColorValue = parseColor(color);
  }

  setBackgroundColor(color: ColorInput): void {
    this.backgroundColorValue = parseColor(color);
  }

  setBrushSize(size: number): void {
    if (!Number.isInteger(size) || size <= 0) {
      throw new Error("Brush size must be a positive integer");
    }

    this.brushSizeValue = size;
  }

  setBrushShape(shape: BrushShape): void {
    if (shape !== "round" && shape !== "square") {
      throw new Error(`Unsupported brush shape: ${shape}`);
    }

    this.brushShapeValue = shape;
  }

  setTransparentPaste(enabled: boolean): void {
    this.transparentPasteValue = Boolean(enabled);
  }

  color(): RGBAColor {
    return { ...this.currentColorValue };
  }

  fillColor(): RGBAColor {
    return { ...this.fillColorValue };
  }

  backgroundColor(): RGBAColor {
    return { ...this.backgroundColorValue };
  }

  brushSize(): number {
    return this.brushSizeValue;
  }

  brushShape(): BrushShape {
    return this.brushShapeValue;
  }

  transparentPaste(): boolean {
    return this.transparentPasteValue;
  }
}
