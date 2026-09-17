/**
 * 画布导出为 JPG：无选中则导出全部节点/边；有选中节点则导出选中子图。
 * 依赖 @logicflow/extension Snapshot（须已注册到主画布）。
 */
import LogicFlow from '@logicflow/core'
import { Snapshot } from '@logicflow/extension'
import { registerFlowNodes } from './registerNodes'
import { cachedComponentTypes } from './componentCatalog'
import type { LfInstance } from './lf-types'

export interface ExportCanvasImageResult {
  ok: boolean
  /** 失败原因（已本地化前的技术说明，由调用方再 t） */
  reason?: 'no-snapshot' | 'empty' | 'failed'
  /** 是否按选中子集导出 */
  selection?: boolean
  fileName?: string
}

type GraphPart = {
  nodes: Array<Record<string, unknown> & { id: string }>
  edges: Array<
    Record<string, unknown> & {
      id?: string
      sourceNodeId: string
      targetNodeId: string
    }
  >
}

const EXPORT_OPTS = {
  fileType: 'jpeg',
  backgroundColor: '#ffffff',
  quality: 0.92,
  padding: 40,
  partial: false,
} as const

/** 生成默认文件名（不含扩展名） */
export function defaultExportFileName(prefix = 'flowgo'): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${prefix}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

/** 读取当前选中节点，及两端均在选中集合内的边 */
function selectionSubgraph(lf: LfInstance): GraphPart | null {
  const sel = lf.getSelectElements?.(true) as GraphPart | undefined
  const nodes = sel?.nodes?.filter((n) => n?.id) || []
  if (!nodes.length) return null
  const ids = new Set(nodes.map((n) => n.id))
  const raw = (lf.getGraphRawData?.() || lf.getGraphData?.()) as GraphPart | undefined
  const edges = (raw?.edges || []).filter(
    (e) => ids.has(e.sourceNodeId) && ids.has(e.targetNodeId),
  )
  return { nodes, edges }
}

/**
 * 在离屏临时画布上渲染子集并导出（避免改动主画布可见性）。
 */
async function exportViaTempLf(
  data: GraphPart,
  fileName: string,
): Promise<void> {
  const host = document.createElement('div')
  host.style.cssText =
    'position:fixed;left:-99999px;top:0;width:960px;height:720px;opacity:0;pointer-events:none;'
  document.body.appendChild(host)
  let temp: LfInstance | null = null
  try {
    temp = new LogicFlow({
      container: host,
      grid: false,
      isSilentMode: true,
      stopZoomGraph: true,
      stopScrollGraph: true,
      history: false,
      snapline: false,
      plugins: [Snapshot],
    })
    registerFlowNodes(temp, cachedComponentTypes())
    temp.render(data as unknown as Record<string, unknown>)
    // 等一帧让视图挂载，再导出
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    await temp.getSnapshot?.(fileName, { ...EXPORT_OPTS })
  } finally {
    try {
      temp?.destroy?.()
    } catch {
      /* 忽略销毁异常 */
    }
    host.remove()
  }
}

/**
 * 导出画布为 JPG 并触发浏览器下载。
 * @param fileNameBase 不含扩展名；Snapshot 会按 fileType 处理
 */
export async function exportCanvasAsJpeg(
  lf: LfInstance | null | undefined,
  fileNameBase?: string,
): Promise<ExportCanvasImageResult> {
  if (!lf?.getSnapshot) {
    return { ok: false, reason: 'no-snapshot' }
  }
  const name = fileNameBase || defaultExportFileName()
  try {
    const sub = selectionSubgraph(lf)
    if (sub) {
      if (!sub.nodes.length) {
        return { ok: false, reason: 'empty' }
      }
      await exportViaTempLf(sub, name)
      return { ok: true, selection: true, fileName: name }
    }
    const raw = (lf.getGraphRawData?.() || lf.getGraphData?.()) as GraphPart | undefined
    if (!raw?.nodes?.length) {
      return { ok: false, reason: 'empty' }
    }
    await lf.getSnapshot(name, { ...EXPORT_OPTS })
    return { ok: true, selection: false, fileName: name }
  } catch (e) {
    console.warn('[exportCanvasAsJpeg]', e)
    return { ok: false, reason: 'failed' }
  }
}
