/**
 * HTTP 入口路径连线的运行：用调试值模拟 HTTP 请求并触发下游。
 */
import { ElMessage } from 'element-plus'
import { t } from '@/i18n'
import { simulateHttpRoute } from '@/api/flow'
import { readRouters, routerLabel } from '@/canvas/httpRouter'
import {
  appendConsoleLog,
  appendServerDebugLogs,
  prepareConsoleForRun,
} from '@/console/useEditorConsole'
import { applyRunResultErrors, clearRunErrors } from '../runErrorHighlight'
import { registerRunHandler } from '../registry'
import type { EdgeRunContext } from '../types'

function resolveRouterIndex(ctx: EdgeRunContext): number {
  if (typeof ctx.routerIndex === 'number' && ctx.routerIndex >= 0) {
    return ctx.routerIndex
  }
  const edge = ctx.lf.getEdgeModelById?.(ctx.edgeId) as
    | { properties?: Record<string, unknown> }
    | undefined
  const fromProps = Number(edge?.properties?.routerIndex)
  if (Number.isFinite(fromProps) && fromProps >= 0) return fromProps

  const source = ctx.lf.getNodeModelById?.(ctx.sourceNodeId)
  const routers = readRouters(source?.properties?.configuration)
  if (ctx.relation) {
    const idx = routers.findIndex((r) => {
      const m = (r.method || 'POST').toUpperCase()
      let p = (r.path || '/').trim() || '/'
      if (!p.startsWith('/')) p = '/' + p
      return `${m} ${p}` === ctx.relation
    })
    if (idx >= 0) return idx
  }
  return 0
}

async function runHttpEndpointEdge(ctx: EdgeRunContext) {
  const source = ctx.lf.getNodeModelById?.(ctx.sourceNodeId)
  if (!source || source.type !== 'httpEndpoint') {
    ElMessage.warning(t('runners.httpEndpoint.unsupported'))
    return
  }
  const routers = readRouters(source.properties?.configuration)
  const idx = resolveRouterIndex(ctx)
  const router = routers[idx]
  if (!router) {
    ElMessage.error(t('runners.httpEndpoint.pathNotFound'))
    return
  }

  clearRunErrors(ctx.lf)
  prepareConsoleForRun()
  const label = routerLabel(router)
  const body = (router.debugValue || '{}').trim() || '{}'
  const nodeName =
    (source.properties?.name as string) || source.text?.value || t('runners.httpEndpoint.defaultName')
  const httpDebug = !!source.properties?.debug

  // 未开调试：控制台不出现入口节点任何日志；下游开调试的节点仍由引擎返回
  if (httpDebug) {
    appendConsoleLog({
      flowType: 'INFO',
      nodeId: ctx.sourceNodeId,
      nodeName,
      relationType: label,
      data: t('runners.httpEndpoint.consoleStart', {
        method: (router.method || 'POST').toUpperCase(),
        path: router.path || '/',
      }),
    })
    appendConsoleLog({
      flowType: 'IN',
      nodeId: ctx.sourceNodeId,
      nodeName,
      data: body,
    })
  }

  try {
    const res = await simulateHttpRoute(ctx.flowId, {
      dsl: ctx.dsl,
      nodeId: ctx.sourceNodeId,
      routerIndex: idx,
      body,
    })
    if (res.logs?.length) {
      appendServerDebugLogs(res.logs)
    }
    if (httpDebug) {
      appendConsoleLog({
        flowType: 'OUT',
        nodeId: ctx.sourceNodeId,
        nodeName,
        relationType: label,
        data: res.data ?? '',
        err: res.error,
      })
    }
    const resolved = applyRunResultErrors(ctx.lf, {
      error: res.error,
      logs: res.logs,
      fallbackNodeId: ctx.targetNodeId || ctx.sourceNodeId,
    })
    if (resolved) {
      if (httpDebug) {
        appendConsoleLog({
          flowType: 'ERROR',
          nodeId: resolved.nodeId,
          nodeName: label,
          data: res.data || '',
          err: resolved.message,
        })
      }
      ElMessage.error(resolved.message)
      return
    }
    ElMessage.success(t('runners.httpEndpoint.success'))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (httpDebug) {
      appendConsoleLog({
        flowType: 'ERROR',
        nodeId: ctx.sourceNodeId,
        nodeName: label,
        err: msg,
      })
    }
    applyRunResultErrors(ctx.lf, {
      error: msg,
      fallbackNodeId: ctx.targetNodeId || ctx.sourceNodeId,
    })
    ElMessage.error(msg)
  }
}

/** 注册 HTTP 路径连线 runner（模块加载时调用一次） */
export function registerHttpEndpointEdgeRunner() {
  registerRunHandler({
    name: 'httpEndpoint-edge',
    match: (ctx) => {
      if (ctx.kind !== 'edge') return false
      const source = ctx.lf.getNodeModelById?.(ctx.sourceNodeId)
      return source?.type === 'httpEndpoint'
    },
    run: async (ctx) => {
      if (ctx.kind !== 'edge') return
      await runHttpEndpointEdge(ctx)
    },
  })
}
