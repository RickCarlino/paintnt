import { Bitmap } from "./bitmap.ts";
import { decodeBmp, encodeBmp } from "./bmp.ts";
import { parseColor } from "./colors.ts";
import { EditManager } from "./edit.ts";
import { ImageManager } from "./image.ts";
import { SelectionManager } from "./selection.ts";
import { PaintState } from "./state.ts";
import { ToolRegistry } from "./tools.ts";
import type { ColorInput, PaintDocumentOptions, Rect } from "./types.ts";
import { assertPositiveInteger } from "./utils.ts";

export class PaintDocument {
  private bitmapValue: Bitmap;
  readonly state: PaintState;
  readonly tools: ToolRegistry;
  readonly selection: SelectionManager;
  readonly edit: EditManager;
  readonly image: ImageManager;

  constructor(options: PaintDocumentOptions) {
    const width = assertPositiveInteger(options.width, "width");
    const height = assertPositiveInteger(options.height, "height");
    const background = options.background ?? "#ffffff";

    this.bitmapValue = new Bitmap(width, height, background);
    this.state = new PaintState(background);
    this.selection = new SelectionManager(this);
    this.edit = new EditManager(this);
    this.image = new ImageManager(this);
    this.tools = new ToolRegistry(this);
  }

  static async open(path: string): Promise<PaintDocument> {
    const bytes = await Bun.file(path).bytes();
    const bitmap = decodeBmp(bytes);
    const doc = new PaintDocument({
      width: bitmap.width,
      height: bitmap.height,
      background: "#ffffff",
    });
    doc.replaceBitmap(bitmap);
    return doc;
  }

  get bitmap(): Bitmap {
    return this.bitmapValue;
  }

  async save(path: string): Promise<void> {
    await Bun.write(path, await this.encode("bmp"));
  }

  async encode(format: "bmp"): Promise<Uint8Array> {
    if (format !== "bmp") {
      throw new Error(`Unsupported export format: ${format}`);
    }

    return encodeBmp(this.bitmapValue);
  }

  drawPixel(x: number, y: number, color: ColorInput): void {
    if (!this.selection.contains(Math.round(x), Math.round(y))) {
      return;
    }

    this.bitmapValue.drawPixel(Math.round(x), Math.round(y), color);
  }

  setPixel(x: number, y: number, color: ColorInput): void {
    if (!this.selection.contains(Math.round(x), Math.round(y))) {
      return;
    }

    this.bitmapValue.setPixel(Math.round(x), Math.round(y), color);
  }

  drawPixelRaw(x: number, y: number, color: ColorInput): void {
    this.bitmapValue.drawPixel(Math.round(x), Math.round(y), color);
  }

  setPixelRaw(x: number, y: number, color: ColorInput): void {
    this.bitmapValue.setPixel(Math.round(x), Math.round(y), color);
  }

  clearRawRect(rect: Rect, color: ColorInput): void {
    this.bitmapValue.clearRect(rect, parseColor(color));
  }

  clearSelectionPixels(color: ColorInput): void {
    const resolved = parseColor(color);
    this.selection.forEachSelected((x, y) => {
      this.bitmapValue.setPixel(x, y, resolved);
    });
  }

  replaceBitmap(bitmap: Bitmap): void {
    this.bitmapValue = bitmap;
    this.selection.clear();
  }
}
