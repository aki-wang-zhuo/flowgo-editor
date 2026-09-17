/**
 * HTTP 客户端节点运行：用 configuration.debugValue 作为实际请求体。
 * mode=run 继续下游；mode=runOnly 只跑本节点。
 * debugValue 仅调试使用，真实部署路径不会读取。
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
  const runOnly = ctx.mode === 'runOnly'

  clearRunErrors(ctx.lf)
  prepareConsoleForRun()
  if (debug) {
    appendConsoleLog({
      flowType: 'INFO',
      nodeId: ctx.nodeId,
      nodeName,
      data: runOnly
        ? t('runners.httpClient.consoleStartOnly')
        : t('runners.httpClient.consoleStart'),
    })
  }

  try {
    const res = await simulateHttpClient(ctx.flowId, {
      dsl: ctx.dsl,
      nodeId: ctx.nodeId,
      body,
      runOnly,
    })
    if (res.logs?.length) {
      appendServerDebugLogs(res.logs)
    }
    const resolved = applyRunResultErrors(ctx.lf, {
      error: res.error,
      logs: res.logs,
      fallbackNodeId: ctx.nodeId,
    })
    if (resolved) {
      if (debug) {
        appendConsoleLog({
          flowType: 'ERROR',
          nodeId: resolved.nodeId,
          nodeName,
          data: res.data || '',
          err: resolved.message,
        })
      }
      ElMessage.error(resolved.message)
      return
    }
    ElMessage.success(
      runOnly ? t('runners.httpClient.successOnly') : t('runners.httpClient.success'),
    )
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
