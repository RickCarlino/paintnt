import { parseColor } from "./colors.ts";
import { DEFAULT_BITMAP_FONT } from "./font.ts";
import type {
  BitmapFont,
  BrushShape,
  ColorInput,
  Point,
  Rect,
} from "./types.ts";
import {
  bresenhamLine,
  colorDistance,
  colorsEqual,
  createSeededRandom,
  cubicBezierPoint,
  estimatePolylineLength,
  normalizeRect,
  pointInPolygon,
  polygonBounds,
} from "./utils.ts";
import type { PaintDocument } from "./document.ts";

export class ToolRegistry {
  readonly pencil: PencilTool;
  readonly brush: BrushTool;
  readonly airbrush: AirbrushTool;
  readonly eraser: EraserTool;
  readonly colorPicker: ColorPickerTool;
  readonly fill: FillTool;
  readonly line: LineTool;
  readonly curve: CurveTool;
  readonly rectangle: RectangleTool;
  readonly roundedRectangle: RoundedRectangleTool;
  readonly ellipse: EllipseTool;
  readonly polygon: PolygonTool;
  readonly text: TextTool;

  constructor(doc: PaintDocument) {
    this.pencil = new PencilTool(doc);
    this.brush = new BrushTool(doc);
    this.airbrush = new AirbrushTool(doc);
    this.eraser = new EraserTool(doc);
    this.colorPicker = new ColorPickerTool(doc);
    this.fill = new FillTool(doc);
    this.line = new LineTool(doc);
    this.curve = new CurveTool(doc);
    this.rectangle = new RectangleTool(doc);
    this.roundedRectangle = new RoundedRectangleTool(doc);
    this.ellipse = new EllipseTool(doc);
    this.polygon = new PolygonTool(doc);
    this.text = new TextTool(doc);
  }
}

class PencilTool {
  constructor(private readonly doc: PaintDocument) {}

  draw(options: { points: Point[]; color?: ColorInput }): void {
    const color = resolveColor(this.doc, options.color);
    strokePolyline(this.doc, options.points, 1, "square", color);
  }
}

class BrushTool {
  constructor(private readonly doc: PaintDocument) {}

  draw(options: {
    points: Point[];
    size?: number;
    shape?: BrushShape;
    color?: ColorInput;
  }): void {
    strokePolyline(
      this.doc,
      options.points,
      options.size ?? this.doc.state.brushSize(),
      options.shape ?? this.doc.state.brushShape(),
      resolveColor(this.doc, options.color),
    );
  }
}

class AirbrushTool {
  constructor(private readonly doc: PaintDocument) {}

  draw(options: {
    center: Point;
    radius: number;
    density: number;
    color?: ColorInput;
    seed?: number;
  }): void {
    if (options.radius <= 0) {
      return;
    }

    const color = resolveColor(this.doc, options.color);
    const density = Math.max(0, Math.min(1, options.density));
    const count = Math.max(1, Math.round(Math.PI * options.radius ** 2 * density));
    const random = createSeededRandom(options.seed ?? 0x12345678);

    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2;
      const distance = Math.sqrt(random()) * options.radius;
      const x = Math.round(options.center.x + Math.cos(angle) * distance);
      const y = Math.round(options.center.y + Math.sin(angle) * distance);
      this.doc.drawPixel(x, y, color);
    }
  }
}

class EraserTool {
  constructor(private readonly doc: PaintDocument) {}

  draw(options: {
    points: Point[];
    size?: number;
    shape?: BrushShape;
    color?: ColorInput;
  }): void {
    strokePolyline(
      this.doc,
      options.points,
      options.size ?? this.doc.state.brushSize(),
      options.shape ?? this.doc.state.brushShape(),
      parseColor(options.color ?? this.doc.state.backgroundColor()),
      true,
    );
  }
}

class ColorPickerTool {
  constructor(private readonly doc: PaintDocument) {}

  pick(options: { x: number; y: number }) {
    return this.doc.bitmap.getPixel(options.x, options.y);
  }
}

class FillTool {
  constructor(private readonly doc: PaintDocument) {}

  draw(options: { x: number; y: number; color?: ColorInput; tolerance?: number }): void {
    if (!this.doc.bitmap.inBounds(options.x, options.y)) {
      return;
    }

    if (!this.doc.selection.contains(options.x, options.y)) {
      return;
    }

    const replacement = resolveColor(this.doc, options.color);
    const target = this.doc.bitmap.getPixel(options.x, options.y);
    const tolerance = Math.max(0, Math.min(255, Math.round(options.tolerance ?? 0)));

    if (colorsEqual(target, replacement)) {
      return;
    }

    const visited = new Uint8Array(this.doc.bitmap.width * this.doc.bitmap.height);
    const queue: Point[] = [{ x: options.x, y: options.y }];

    while (queue.length > 0) {
      const current = queue.pop()!;

      if (!this.doc.bitmap.inBounds(current.x, current.y)) {
        continue;
      }

      if (!this.doc.selection.contains(current.x, current.y)) {
        continue;
      }

      const index = current.y * this.doc.bitmap.width + current.x;

      if (visited[index] === 1) {
        continue;
      }

      visited[index] = 1;
      const currentColor = this.doc.bitmap.getPixel(current.x, current.y);

      if (colorDistance(currentColor, target) > tolerance) {
        continue;
      }

      this.doc.setPixelRaw(current.x, current.y, replacement);
      queue.push({ x: current.x + 1, y: current.y });
      queue.push({ x: current.x - 1, y: current.y });
      queue.push({ x: current.x, y: current.y + 1 });
      queue.push({ x: current.x, y: current.y - 1 });
    }
  }
}

class LineTool {
  constructor(private readonly doc: PaintDocument) {}

  draw(options: { from: Point; to: Point; color?: ColorInput; thickness?: number }): void {
    strokePolyline(
      this.doc,
      [options.from, options.to],
      options.thickness ?? 1,
      "round",
      resolveColor(this.doc, options.color),
    );
  }
}

class CurveTool {
  constructor(private readonly doc: PaintDocument) {}

  draw(options: {
    from: Point;
    to: Point;
    control1: Point;
    control2: Point;
    color?: ColorInput;
    thickness?: number;
  }): void {
    const roughLength = estimatePolylineLength([
      options.from,
      options.control1,
      options.control2,
      options.to,
    ]);
    const steps = Math.max(8, Math.ceil(roughLength * 2));
    const points: Point[] = [];

    for (let step = 0; step <= steps; step += 1) {
      points.push(
        cubicBezierPoint(
          options.from,
          options.control1,
          options.control2,
          options.to,
          step / steps,
        ),
      );
    }

    strokePolyline(
      this.doc,
      points,
      options.thickness ?? 1,
      "round",
      resolveColor(this.doc, options.color),
    );
  }
}

class RectangleTool {
  constructor(private readonly doc: PaintDocument) {}

  draw(options: { x: number; y: number; width: number; height: number; stroke?: ColorInput; fill?: ColorInput }): void {
    const rect = normalizeRect(options);

    if (rect.width === 0 || rect.height === 0) {
      return;
    }

    const stroke = options.stroke !== undefined || options.fill === undefined
      ? resolveColor(this.doc, options.stroke)
      : null;
    const fill = options.fill !== undefined ? parseColor(options.fill) : null;

    if (fill) {
      for (let y = rect.y; y < rect.y + rect.height; y += 1) {
        for (let x = rect.x; x < rect.x + rect.width; x += 1) {
          this.doc.drawPixel(x, y, fill);
        }
      }
    }

    if (stroke) {
      strokePolyline(this.doc, [{ x: rect.x, y: rect.y }, { x: rect.x + rect.width - 1, y: rect.y }], 1, "square", stroke);
      strokePolyline(this.doc, [{ x: rect.x, y: rect.y }, { x: rect.x, y: rect.y + rect.height - 1 }], 1, "square", stroke);
      strokePolyline(
        this.doc,
        [
          { x: rect.x + rect.width - 1, y: rect.y },
          { x: rect.x + rect.width - 1, y: rect.y + rect.height - 1 },
        ],
        1,
        "square",
        stroke,
      );
      strokePolyline(
        this.doc,
        [
          { x: rect.x, y: rect.y + rect.height - 1 },
          { x: rect.x + rect.width - 1, y: rect.y + rect.height - 1 },
        ],
        1,
        "square",
        stroke,
      );
    }
  }
}

class RoundedRectangleTool {
  constructor(private readonly doc: PaintDocument) {}

  draw(options: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
    stroke?: ColorInput;
    fill?: ColorInput;
  }): void {
    const rect = normalizeRect(options);

    if (rect.width === 0 || rect.height === 0) {
      return;
    }

    const radius = Math.max(0, Math.min(options.radius, Math.floor(Math.min(rect.width, rect.height) / 2)));
    const stroke = options.stroke !== undefined || options.fill === undefined
      ? resolveColor(this.doc, options.stroke)
      : null;
    const fill = options.fill !== undefined ? parseColor(options.fill) : null;

    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        const outer = isInsideRoundedRectPixel(
          x + 0.5 - rect.x,
          y + 0.5 - rect.y,
          rect.width,
          rect.height,
          radius,
        );

        if (!outer) {
          continue;
        }

        if (fill) {
          this.doc.drawPixel(x, y, fill);
        }

        if (stroke) {
          const inner = radius > 0 && rect.width > 2 && rect.height > 2
            ? isInsideRoundedRectPixel(
                x + 0.5 - rect.x - 1,
                y + 0.5 - rect.y - 1,
                rect.width - 2,
                rect.height - 2,
                Math.max(0, radius - 1),
              )
            : false;

          if (!inner) {
            this.doc.drawPixel(x, y, stroke);
          }
        }
      }
    }
  }
}

class EllipseTool {
  constructor(private readonly doc: PaintDocument) {}

  draw(options: { x: number; y: number; width: number; height: number; stroke?: ColorInput; fill?: ColorInput }): void {
    const rect = normalizeRect(options);

    if (rect.width === 0 || rect.height === 0) {
      return;
    }

    const stroke = options.stroke !== undefined || options.fill === undefined
      ? resolveColor(this.doc, options.stroke)
      : null;
    const fill = options.fill !== undefined ? parseColor(options.fill) : null;
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const radiusX = rect.width / 2;
    const radiusY = rect.height / 2;
    const innerRadiusX = Math.max(0, radiusX - 1);
    const innerRadiusY = Math.max(0, radiusY - 1);

    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        const distance = ellipseDistance(x + 0.5, y + 0.5, centerX, centerY, radiusX, radiusY);

        if (distance > 1) {
          continue;
        }

        if (fill) {
          this.doc.drawPixel(x, y, fill);
        }

        if (stroke) {
          const innerDistance =
            innerRadiusX <= 0 || innerRadiusY <= 0
              ? Infinity
              : ellipseDistance(
                  x + 0.5,
                  y + 0.5,
                  centerX,
                  centerY,
                  innerRadiusX,
                  innerRadiusY,
                );

          if (innerDistance > 1) {
            this.doc.drawPixel(x, y, stroke);
          }
        }
      }
    }
  }
}

class PolygonTool {
  constructor(private readonly doc: PaintDocument) {}

  draw(options: { points: Point[]; stroke?: ColorInput; fill?: ColorInput }): void {
    if (options.points.length === 0) {
      return;
    }

    const stroke = options.stroke !== undefined || options.fill === undefined
      ? resolveColor(this.doc, options.stroke)
      : null;
    const fill = options.fill !== undefined ? parseColor(options.fill) : null;

    if (fill && options.points.length >= 3) {
      const bounds = polygonBounds(options.points);

      for (let y = bounds.y; y < bounds.y + bounds.height; y += 1) {
        for (let x = bounds.x; x < bounds.x + bounds.width; x += 1) {
          if (pointInPolygon({ x: x + 0.5, y: y + 0.5 }, options.points)) {
            this.doc.drawPixel(x, y, fill);
          }
        }
      }
    }

    if (!stroke) {
      return;
    }

    for (let index = 0; index < options.points.length; index += 1) {
      const current = options.points[index];
      const next = options.points[(index + 1) % options.points.length];
      strokePolyline(this.doc, [current, next], 1, "square", stroke);
    }
  }
}

class TextTool {
  constructor(private readonly doc: PaintDocument) {}

  draw(options: {
    x: number;
    y: number;
    text: string;
    color?: ColorInput;
    background?: ColorInput | "transparent";
    font?: BitmapFont;
  }): void {
    const font = options.font ?? DEFAULT_BITMAP_FONT;
    const foreground = resolveColor(this.doc, options.color);
    const background =
      options.background === undefined || options.background === "transparent"
        ? null
        : parseColor(options.background);
    let cursorX = options.x;
    let cursorY = options.y;
    const lineStartX = options.x;

    for (const char of options.text) {
      if (char === "\r") {
        continue;
      }

      if (char === "\n") {
        cursorX = lineStartX;
        cursorY += font.lineHeight;
        continue;
      }

      if (char === "\t") {
        cursorX += (font.glyphWidth + font.spacing) * 4;
        continue;
      }

      const glyph = font.resolve(char);

      if (background) {
        for (let y = 0; y < font.glyphHeight; y += 1) {
          for (let x = 0; x < glyph.xAdvance; x += 1) {
            this.doc.drawPixel(cursorX + x, cursorY + y, background);
          }
        }
      }

      for (let rowIndex = 0; rowIndex < glyph.rows.length; rowIndex += 1) {
        const row = glyph.rows[rowIndex];

        for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
          if (row[columnIndex] === "1") {
            this.doc.drawPixel(cursorX + columnIndex, cursorY + rowIndex, foreground);
          }
        }
      }

      cursorX += glyph.xAdvance + font.spacing;
    }
  }
}

function resolveColor(doc: PaintDocument, color?: ColorInput) {
  return parseColor(color ?? doc.state.color());
}

function strokePolyline(
  doc: PaintDocument,
  points: Point[],
  size: number,
  shape: BrushShape,
  color: ReturnType<typeof parseColor>,
  direct = false,
): void {
  if (points.length === 0) {
    return;
  }

  const thickness = Math.max(1, Math.round(size));

  if (points.length === 1) {
    stampBrush(doc, points[0], thickness, shape, color, direct);
    return;
  }

  for (let index = 1; index < points.length; index += 1) {
    const linePoints = bresenhamLine(points[index - 1], points[index]);

    for (const point of linePoints) {
      stampBrush(doc, point, thickness, shape, color, direct);
    }
  }
}

function stampBrush(
  doc: PaintDocument,
  center: Point,
  size: number,
  shape: BrushShape,
  color: ReturnType<typeof parseColor>,
  direct: boolean,
): void {
  if (size <= 1) {
    if (direct) {
      doc.setPixel(center.x, center.y, color);
    } else {
      doc.drawPixel(center.x, center.y, color);
    }

    return;
  }

  const startX = Math.round(center.x - (size - 1) / 2);
  const startY = Math.round(center.y - (size - 1) / 2);
  const radius = size / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const pixelX = startX + x;
      const pixelY = startY + y;

      if (shape === "round") {
        const dx = pixelX + 0.5 - center.x;
        const dy = pixelY + 0.5 - center.y;

        if (dx * dx + dy * dy > radius * radius) {
          continue;
        }
      }

      if (direct) {
        doc.setPixel(pixelX, pixelY, color);
      } else {
        doc.drawPixel(pixelX, pixelY, color);
      }
    }
  }
}

function ellipseDistance(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
): number {
  return ((x - centerX) / radiusX) ** 2 + ((y - centerY) / radiusY) ** 2;
}

function isInsideRoundedRectPixel(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): boolean {
  if (width <= 0 || height <= 0) {
    return false;
  }

  if (radius <= 0) {
    return x >= 0 && y >= 0 && x < width && y < height;
  }

  const clampedX = Math.max(radius, Math.min(width - radius, x));
  const clampedY = Math.max(radius, Math.min(height - radius, y));
  const dx = x - clampedX;
  const dy = y - clampedY;

  return dx * dx + dy * dy <= radius * radius;
}
