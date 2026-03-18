import { Bitmap } from "./bitmap.js";
import { PaintDocument } from "./document.js";
import type { ColorInput } from "./types.js";

export interface ImageDataLike {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export interface CanvasContext2DLike {
  getImageData(sx: number, sy: number, sw: number, sh: number): ImageDataLike;
  putImageData(imageData: ImageDataLike, dx: number, dy: number): void;
}

export interface CanvasLike {
  width: number;
  height: number;
  getContext(contextId: "2d"): CanvasContext2DLike | null;
}

export function bitmapFromImageData(imageData: ImageDataLike): Bitmap {
  assertImageDataLike(imageData);
  return Bitmap.fromRGBA(imageData.width, imageData.height, imageData.data);
}

export function imageDataFromBitmap(bitmap: Bitmap): ImageDataLike {
  return createImageDataLike(
    new Uint8ClampedArray(bitmap.toRGBA()),
    bitmap.width,
    bitmap.height,
  );
}

export function documentFromImageData(
  imageData: ImageDataLike,
  options?: { background?: ColorInput },
): PaintDocument {
  return PaintDocument.fromBitmap(bitmapFromImageData(imageData), options);
}

export function imageDataFromDocument(doc: PaintDocument): ImageDataLike {
  return imageDataFromBitmap(doc.bitmap);
}

export function documentFromCanvas(
  canvas: CanvasLike,
  options?: { background?: ColorInput },
): PaintDocument {
  const context = require2DContext(canvas);
  return documentFromImageData(
    context.getImageData(0, 0, canvas.width, canvas.height),
    options,
  );
}

export function renderDocumentToCanvas(
  doc: PaintDocument,
  canvas: CanvasLike,
  options?: { x?: number; y?: number; resizeCanvas?: boolean },
): void {
  if (options?.resizeCanvas) {
    canvas.width = doc.bitmap.width;
    canvas.height = doc.bitmap.height;
  }

  const context = require2DContext(canvas);
  context.putImageData(
    imageDataFromDocument(doc),
    options?.x ?? 0,
    options?.y ?? 0,
  );
}

function require2DContext(canvas: CanvasLike): CanvasContext2DLike {
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error('Canvas does not provide a "2d" context');
  }

  return context;
}

function assertImageDataLike(imageData: ImageDataLike): void {
  if (imageData.width <= 0 || imageData.height <= 0) {
    throw new Error("ImageData dimensions must be greater than 0");
  }

  if (imageData.data.length !== imageData.width * imageData.height * 4) {
    throw new Error("ImageData buffer length does not match dimensions");
  }
}

function createImageDataLike(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): ImageDataLike {
  if (typeof ImageData !== "undefined") {
    const copy = new Uint8ClampedArray(data.length);
    copy.set(data);
    return new ImageData(copy, width, height);
  }

  return {
    data,
    width,
    height,
  };
}

export * from "./index.js";
