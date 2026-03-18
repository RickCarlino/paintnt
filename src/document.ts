import { Bitmap } from "./bitmap.js";
import { decodeBmp, encodeBmp } from "./bmp.js";
import { parseColor } from "./colors.js";
import { EditManager } from "./edit.js";
import { ImageManager } from "./image.js";
import { SelectionManager } from "./selection.js";
import { PaintState } from "./state.js";
import { ToolRegistry } from "./tools.js";
import type {
  ColorInput,
  PaintDocumentImportOptions,
  PaintDocumentIO,
  PaintDocumentOptions,
  Rect,
} from "./types.js";
import { assertPositiveInteger } from "./utils.js";

const MISSING_DOCUMENT_IO_ERROR =
  'Path-based document I/O is not configured. Import from "paintnt/node" for filesystem access, or use PaintDocument.fromBytes() in runtime-neutral code.';

export class PaintDocument {
  private static io: PaintDocumentIO | null = null;
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

  static configureIO(io: PaintDocumentIO | null): void {
    PaintDocument.io = io;
  }

  static async open(path: string | URL): Promise<PaintDocument> {
    if (!PaintDocument.io) {
      throw new Error(MISSING_DOCUMENT_IO_ERROR);
    }

    const bytes = await PaintDocument.io.open(path);
    return PaintDocument.fromBytes(bytes, "bmp");
  }

  static fromBytes(
    bytes: Uint8Array,
    format: "bmp",
    options?: PaintDocumentImportOptions,
  ): PaintDocument {
    if (format !== "bmp") {
      throw new Error(`Unsupported import format: ${format}`);
    }

    return PaintDocument.fromBitmap(decodeBmp(bytes), options);
  }

  static fromBitmap(bitmap: Bitmap, options?: PaintDocumentImportOptions): PaintDocument {
    const doc = new PaintDocument({
      width: bitmap.width,
      height: bitmap.height,
      background: options?.background ?? "#ffffff",
    });
    doc.replaceBitmap(bitmap.clone());
    return doc;
  }

  get bitmap(): Bitmap {
    return this.bitmapValue;
  }

  async save(path: string | URL): Promise<void> {
    if (!PaintDocument.io) {
      throw new Error(MISSING_DOCUMENT_IO_ERROR);
    }

    await PaintDocument.io.save(path, await this.encode("bmp"));
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
