/**
 * HTTP 客户端节点运行：用 configuration.debugValue 作为实际请求体并执行本节点及后续。
 * 不渲染 body 模板；debugValue 仅调试使用，真实部署路径不会读取。
 */
import { ElMessage } from 'element-plus'
import { t } from '@/i18n'
import { simulateHttpClient } from '@/api/flow'
import {
  appendConsoleLog,
  appendServerDebugLogs,
  prepareConsoleForRun,
} from '@/console/useEditorConsole'
import { applyRunResultErrors, clearRunErrors } from '../runErrorHighlight'
import { registerRunHandler } from '../registry'
import type { NodeRunContext } from '../types'

function readDebugValue(configuration: unknown): string {
  const conf = (configuration || {}) as Record<string, unknown>
  const s = String(conf.debugValue || '').trim()
  return s || '{}'
}

async function runHttpClientNode(ctx: NodeRunContext) {
  const model = ctx.lf.getNodeModelById?.(ctx.nodeId) as
    | {
        type?: string
        text?: { value?: string }
        properties?: Record<string, unknown>
      }
    | undefined
  if (!model || model.type !== 'httpClient') {
    ElMessage.warning(t('runners.httpClient.unsupported'))
    return
  }

  const body = readDebugValue(model.properties?.configuration)
  const nodeName =
    (model.properties?.name as string) || model.text?.value || t('runners.httpClient.defaultName')
  const debug = !!model.properties?.debug

  clearRunErrors(ctx.lf)
  prepareConsoleForRun()
  // 未开调试：控制台不出现本节点任何日志（下游开调试的节点仍由引擎返回）
  if (debug) {
    appendConsoleLog({
      flowType: 'INFO',
      nodeId: ctx.nodeId,
      nodeName,
      data: t('runners.httpClient.consoleStart'),
    })
  }

  try {
    const res = await simulateHttpClient(ctx.flowId, {
      dsl: ctx.dsl,
      nodeId: ctx.nodeId,
      body,
    })
    if (res.logs?.length) {
      appendServerDebugLogs(res.logs)
    }
    if (res.error) {
      if (debug) {
        appendConsoleLog({
          flowType: 'ERROR',
          nodeId: ctx.nodeId,
          nodeName,
          data: res.data || '',
          err: res.error,
        })
      }
      applyRunResultErrors(ctx.lf, {
        error: res.error,
        logs: res.logs,
        fallbackNodeId: ctx.nodeId,
      })
      ElMessage.error(res.error)
      return
    }
    clearRunErrors(ctx.lf)
    ElMessage.success(t('runners.httpClient.success'))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (debug) {
      appendConsoleLog({
        flowType: 'ERROR',
        nodeId: ctx.nodeId,
        nodeName,
        err: msg,
      })
    }
    applyRunResultErrors(ctx.lf, {
      error: msg,
      fallbackNodeId: ctx.nodeId,
    })
    ElMessage.error(msg)
  }
}

/** 注册 HTTP 客户端节点 runner */
export function registerHttpClientNodeRunner() {
  registerRunHandler({
    name: 'httpClient-node',
    match: (ctx) => {
      if (ctx.kind !== 'node') return false
      const model = ctx.lf.getNodeModelById?.(ctx.nodeId)
      return model?.type === 'httpClient'
    },
    run: async (ctx) => {
      if (ctx.kind !== 'node') return
      await runHttpClientNode(ctx)
    },
  })
}
