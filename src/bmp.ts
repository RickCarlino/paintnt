import { Bitmap } from "./bitmap.js";

const BMP_FILE_HEADER_SIZE = 14;
const BMP_INFO_HEADER_SIZE = 40;

export function encodeBmp(bitmap: Bitmap): Uint8Array {
  const rowStride = bitmap.width * 4;
  const pixelDataSize = rowStride * bitmap.height;
  const fileSize = BMP_FILE_HEADER_SIZE + BMP_INFO_HEADER_SIZE + pixelDataSize;
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  const rgba = bitmap.toRGBA();

  view.setUint8(0, 0x42);
  view.setUint8(1, 0x4d);
  view.setUint32(2, fileSize, true);
  view.setUint32(10, BMP_FILE_HEADER_SIZE + BMP_INFO_HEADER_SIZE, true);
  view.setUint32(14, BMP_INFO_HEADER_SIZE, true);
  view.setInt32(18, bitmap.width, true);
  view.setInt32(22, bitmap.height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 32, true);
  view.setUint32(30, 0, true);
  view.setUint32(34, pixelDataSize, true);
  view.setInt32(38, 2835, true);
  view.setInt32(42, 2835, true);

  let destination = BMP_FILE_HEADER_SIZE + BMP_INFO_HEADER_SIZE;

  for (let y = bitmap.height - 1; y >= 0; y -= 1) {
    for (let x = 0; x < bitmap.width; x += 1) {
      const source = (y * bitmap.width + x) * 4;
      view.setUint8(destination, rgba[source + 2]);
      view.setUint8(destination + 1, rgba[source + 1]);
      view.setUint8(destination + 2, rgba[source]);
      view.setUint8(destination + 3, rgba[source + 3]);
      destination += 4;
    }
  }

  return new Uint8Array(buffer);
}

export function decodeBmp(bytes: Uint8Array): Bitmap {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (view.getUint8(0) !== 0x42 || view.getUint8(1) !== 0x4d) {
    throw new Error("Not a BMP file");
  }

  const pixelOffset = view.getUint32(10, true);
  const headerSize = view.getUint32(14, true);

  if (headerSize < BMP_INFO_HEADER_SIZE) {
    throw new Error("Unsupported BMP header");
  }

  const width = view.getInt32(18, true);
  const rawHeight = view.getInt32(22, true);
  const height = Math.abs(rawHeight);
  const planes = view.getUint16(26, true);
  const bitsPerPixel = view.getUint16(28, true);
  const compression = view.getUint32(30, true);

  if (planes !== 1) {
    throw new Error("Unsupported BMP plane count");
  }

  if (![24, 32].includes(bitsPerPixel)) {
    throw new Error(`Unsupported BMP bit depth: ${bitsPerPixel}`);
  }

  if (![0, 3].includes(compression)) {
    throw new Error(`Unsupported BMP compression: ${compression}`);
  }

  const bitmap = new Bitmap(width, height);
  const topDown = rawHeight < 0;
  const bytesPerPixel = bitsPerPixel / 8;
  const rowStride = Math.ceil((width * bitsPerPixel) / 32) * 4;

  for (let row = 0; row < height; row += 1) {
    const sourceRow = topDown ? row : height - 1 - row;
    let sourceOffset = pixelOffset + sourceRow * rowStride;

    for (let x = 0; x < width; x += 1) {
      const b = view.getUint8(sourceOffset);
      const g = view.getUint8(sourceOffset + 1);
      const r = view.getUint8(sourceOffset + 2);
      const a = bytesPerPixel === 4 ? view.getUint8(sourceOffset + 3) : 255;
      bitmap.setPixel(x, row, { r, g, b, a });
      sourceOffset += bytesPerPixel;
    }
  }

  return bitmap;
}
