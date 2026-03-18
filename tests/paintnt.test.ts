import { expect, test } from "bun:test";

import {
  Colors,
  PaintDocument,
  documentFromCanvas,
  documentFromImageData,
  imageDataFromDocument,
  renderDocumentToCanvas,
} from "../src/browser.js";
import { PaintDocument as NodePaintDocument } from "../src/node.js";

function rgba(color: { r: number; g: number; b: number; a: number }) {
  return [color.r, color.g, color.b, color.a];
}

function countOpaquePixels(doc: PaintDocument): number {
  let count = 0;

  for (let y = 0; y < doc.bitmap.height; y += 1) {
    for (let x = 0; x < doc.bitmap.width; x += 1) {
      if (doc.bitmap.getPixel(x, y).a > 0) {
        count += 1;
      }
    }
  }

  return count;
}

test("saves and reopens BMP documents through the Node adapter", async () => {
  const doc = new PaintDocument({
    width: 8,
    height: 6,
    background: Colors.white(),
  });

  doc.tools.line.draw({
    from: { x: 0, y: 0 },
    to: { x: 7, y: 5 },
    color: Colors.black(),
  });
  doc.tools.rectangle.draw({
    x: 1,
    y: 1,
    width: 3,
    height: 3,
    fill: Colors.red(),
  });
  doc.tools.fill.draw({
    x: 7,
    y: 0,
    color: Colors.blue(),
  });

  const path = `/tmp/paintnt-roundtrip-${Date.now()}.bmp`;
  await doc.save(path);

  const reopened = await NodePaintDocument.open(path);
  expect(reopened.image.getAttributes()).toEqual({ width: 8, height: 6 });
  expect(rgba(reopened.bitmap.getPixel(1, 1))).toEqual([255, 0, 0, 255]);
  expect(rgba(reopened.bitmap.getPixel(7, 0))).toEqual([0, 0, 255, 255]);
  expect(rgba(reopened.bitmap.getPixel(0, 0))).toEqual([0, 0, 0, 255]);
});

test("copies a free-form selection and pastes transparently", () => {
  const source = new PaintDocument({
    width: 5,
    height: 5,
    background: Colors.white(),
  });

  source.tools.rectangle.draw({
    x: 0,
    y: 0,
    width: 5,
    height: 5,
    fill: Colors.red(),
  });
  source.selection.setMask({
    bounds: { x: 0, y: 0, width: 5, height: 5 },
    isSelected(x, y) {
      return x === 2 || y === 2;
    },
  });

  const clip = source.edit.copy();

  const destination = new PaintDocument({
    width: 7,
    height: 7,
    background: Colors.blue(),
  });

  destination.edit.paste(clip, {
    x: 1,
    y: 1,
    transparent: true,
  });

  expect(rgba(destination.bitmap.getPixel(3, 1))).toEqual([255, 0, 0, 255]);
  expect(rgba(destination.bitmap.getPixel(1, 1))).toEqual([0, 0, 255, 255]);
  expect(rgba(destination.bitmap.getPixel(3, 3))).toEqual([255, 0, 0, 255]);
});

test("rotates the full canvas by 90 degrees", () => {
  const doc = new PaintDocument({
    width: 3,
    height: 2,
    background: "transparent",
  });

  doc.tools.pencil.draw({
    points: [{ x: 0, y: 0 }],
    color: Colors.black(),
  });
  doc.tools.pencil.draw({
    points: [{ x: 2, y: 1 }],
    color: Colors.red(),
  });

  doc.image.rotate(90);

  expect(doc.image.getAttributes()).toEqual({ width: 2, height: 3 });
  expect(rgba(doc.bitmap.getPixel(1, 0))).toEqual([0, 0, 0, 255]);
  expect(rgba(doc.bitmap.getPixel(0, 2))).toEqual([255, 0, 0, 255]);
});

test("renders text with the shipped default font and loads the atlas asset", async () => {
  const doc = new PaintDocument({
    width: 40,
    height: 10,
    background: "transparent",
  });

  doc.tools.text.draw({
    x: 0,
    y: 0,
    text: "Aa?!",
    color: Colors.black(),
  });

  expect(countOpaquePixels(doc)).toBeGreaterThan(0);
  expect(rgba(doc.bitmap.getPixel(1, 0))).toEqual([0, 0, 0, 255]);
  expect(rgba(doc.bitmap.getPixel(7, 0))).toEqual([0, 0, 0, 255]);

  const atlas = await NodePaintDocument.open("/home/rick/code/canvas-lib/assets/default-font.bmp");
  expect(atlas.bitmap.width).toBeGreaterThan(0);
  expect(atlas.bitmap.height).toBeGreaterThan(0);
  expect(rgba(atlas.bitmap.getPixel(0, 0))).toEqual([255, 255, 255, 255]);
  expect(rgba(atlas.bitmap.getPixel(1, 0))).toEqual([255, 255, 255, 255]);
});

test("round-trips documents through browser image data and canvas adapters", () => {
  const doc = new PaintDocument({
    width: 3,
    height: 2,
    background: "transparent",
  });

  doc.tools.rectangle.draw({
    x: 0,
    y: 0,
    width: 2,
    height: 2,
    fill: Colors.red(),
  });
  doc.tools.pencil.draw({
    points: [{ x: 2, y: 1 }],
    color: Colors.blue(),
  });

  const imageData = imageDataFromDocument(doc);
  const fromImageData = documentFromImageData(imageData);

  expect(rgba(fromImageData.bitmap.getPixel(0, 0))).toEqual([255, 0, 0, 255]);
  expect(rgba(fromImageData.bitmap.getPixel(2, 1))).toEqual([0, 0, 255, 255]);

  let rendered: { width: number; height: number; data: Uint8ClampedArray } | null = null;
  const canvas = {
    width: 1,
    height: 1,
    getContext(contextId: "2d") {
      expect(contextId).toBe("2d");
      return {
        getImageData() {
          if (!rendered) {
            throw new Error("No image has been rendered");
          }

          return rendered;
        },
        putImageData(imageData: { width: number; height: number; data: Uint8ClampedArray }) {
          rendered = imageData;
        },
      };
    },
  };

  renderDocumentToCanvas(doc, canvas, { resizeCanvas: true });

  expect(canvas.width).toBe(3);
  expect(canvas.height).toBe(2);
  expect(rendered?.data.length).toBe(24);

  const fromCanvas = documentFromCanvas(canvas);
  expect(rgba(fromCanvas.bitmap.getPixel(1, 1))).toEqual([255, 0, 0, 255]);
  expect(rgba(fromCanvas.bitmap.getPixel(2, 1))).toEqual([0, 0, 255, 255]);
});
