import type { Anchor, Point, Rect, RGBAColor } from "./types.js";

export function assertInteger(value: number, label: string): number {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer`);
  }

  return value;
}

export function assertPositiveInteger(value: number, label: string): number {
  assertInteger(value, label);

  if (value <= 0) {
    throw new Error(`${label} must be greater than 0`);
  }

  return value;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function clampByte(value: number): number {
  return clamp(Math.round(value), 0, 255);
}

export function nearlyZero(value: number): boolean {
  return Math.abs(value) < 1e-9;
}

export function cloneColor(color: RGBAColor): RGBAColor {
  return { ...color };
}

export function rectContains(rect: Rect, x: number, y: number): boolean {
  return (
    x >= rect.x &&
    y >= rect.y &&
    x < rect.x + rect.width &&
    y < rect.y + rect.height
  );
}

export function normalizeRect(rect: Rect): Rect {
  const x2 = rect.x + rect.width;
  const y2 = rect.y + rect.height;
  const x = Math.min(rect.x, x2);
  const y = Math.min(rect.y, y2);
  const width = Math.abs(rect.width);
  const height = Math.abs(rect.height);

  return { x, y, width, height };
}

export function intersectRect(a: Rect, b: Rect): Rect | null {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);

  if (right <= left || bottom <= top) {
    return null;
  }

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

export function rectFromSize(width: number, height: number): Rect {
  return { x: 0, y: 0, width, height };
}

export function anchorOffset(
  anchor: Anchor,
  containerWidth: number,
  containerHeight: number,
  contentWidth: number,
  contentHeight: number,
): Point {
  const x =
    anchor.endsWith("left")
      ? 0
      : anchor.endsWith("right")
        ? containerWidth - contentWidth
        : Math.floor((containerWidth - contentWidth) / 2);

  const y =
    anchor.startsWith("top")
      ? 0
      : anchor.startsWith("bottom")
        ? containerHeight - contentHeight
        : Math.floor((containerHeight - contentHeight) / 2);

  return { x, y };
}

export function bresenhamLine(from: Point, to: Point): Point[] {
  const points: Point[] = [];
  let x0 = Math.round(from.x);
  let y0 = Math.round(from.y);
  const x1 = Math.round(to.x);
  const y1 = Math.round(to.y);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;

  while (true) {
    points.push({ x: x0, y: y0 });

    if (x0 === x1 && y0 === y1) {
      break;
    }

    const doubleError = error * 2;

    if (doubleError >= dy) {
      error += dy;
      x0 += sx;
    }

    if (doubleError <= dx) {
      error += dx;
      y0 += sy;
    }
  }

  return points;
}

export function cubicBezierPoint(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number,
): Point {
  const oneMinusT = 1 - t;
  const x =
    oneMinusT ** 3 * p0.x +
    3 * oneMinusT ** 2 * t * p1.x +
    3 * oneMinusT * t ** 2 * p2.x +
    t ** 3 * p3.x;
  const y =
    oneMinusT ** 3 * p0.y +
    3 * oneMinusT ** 2 * t * p1.y +
    3 * oneMinusT * t ** 2 * p2.y +
    t ** 3 * p3.y;

  return { x, y };
}

export function estimatePolylineLength(points: Point[]): number {
  let total = 0;

  for (let index = 1; index < points.length; index += 1) {
    const dx = points[index].x - points[index - 1].x;
    const dy = points[index].y - points[index - 1].y;
    total += Math.hypot(dx, dy);
  }

  return total;
}

export function polygonBounds(points: Point[]): Rect {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.floor(Math.min(...xs));
  const minY = Math.floor(Math.min(...ys));
  const maxX = Math.ceil(Math.max(...xs));
  const maxY = Math.ceil(Math.max(...ys));

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi || 1e-9) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function colorDistance(a: RGBAColor, b: RGBAColor): number {
  return Math.max(
    Math.abs(a.r - b.r),
    Math.abs(a.g - b.g),
    Math.abs(a.b - b.b),
    Math.abs(a.a - b.a),
  );
}

export function colorsEqual(a: RGBAColor, b: RGBAColor): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

export function rotatePointClockwise90(point: Point, width: number, height: number): Point {
  return {
    x: height - 1 - point.y,
    y: point.x,
  };
}

export function rotatePointClockwise180(point: Point, width: number, height: number): Point {
  return {
    x: width - 1 - point.x,
    y: height - 1 - point.y,
  };
}

export function rotatePointClockwise270(point: Point, width: number, height: number): Point {
  return {
    x: point.y,
    y: width - 1 - point.x,
  };
}
