import { readFile, writeFile } from "node:fs/promises";

import { PaintDocument } from "./document.js";

async function readDocumentBytes(path: string | URL): Promise<Uint8Array> {
  return new Uint8Array(await readFile(path));
}

async function writeDocumentBytes(path: string | URL, bytes: Uint8Array): Promise<void> {
  await writeFile(path, bytes);
}

PaintDocument.configureIO({
  open: readDocumentBytes,
  save: writeDocumentBytes,
});

export async function openDocument(path: string | URL): Promise<PaintDocument> {
  return PaintDocument.fromBytes(await readDocumentBytes(path), "bmp");
}

export async function saveDocument(
  doc: PaintDocument,
  path: string | URL,
): Promise<void> {
  await writeDocumentBytes(path, await doc.encode("bmp"));
}

export * from "./index.js";
