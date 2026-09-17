/**
 * 三次贝塞尔几何：标签落点与「点到曲线」距离（用于拖入连线检测）。
 */
export type BezierPoint = { x: number; y: number }

/** 拖入插入时边的高亮属性键（FlowEdgeModel 读取） */
export const INSERT_HIGHLIGHT_KEY = 'insertHighlight'

/**
 * 三次贝塞尔曲线上参数 t∈[0,1] 的点。
 */
export function cubicBezierPoint(
  p0: BezierPoint,
  p1: BezierPoint,
  p2: BezierPoint,
  p3: BezierPoint,
  t: number,
): BezierPoint {
  const u = 1 - t
  const uu = u * u
  const tt = t * t
  const uuu = uu * u
  const ttt = tt * t
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  }
}

/**
 * 点到贝塞尔曲线的近似最短距离（均匀采样）。
 */
export function distPointToBezier(
  px: number,
  py: number,
  pts: BezierPoint[],
  samples = 48,
): number {
  if (!pts.length) return Number.POSITIVE_INFINITY
  if (pts.length < 4) {
    const a = pts[0]
    const b = pts[pts.length - 1]
    return distPointToSegment(px, py, a.x, a.y, b.x, b.y)
  }
  const [p0, p1, p2, p3] = pts
  let min = Number.POSITIVE_INFINITY
  for (let i = 0; i <= samples; i++) {
    const p = cubicBezierPoint(p0, p1, p2, p3, i / samples)
    const d = Math.hypot(p.x - px, p.y - py)
    if (d < min) min = d
  }
  return min
}

/** 点到线段最短距离 */
function distPointToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-8) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}
