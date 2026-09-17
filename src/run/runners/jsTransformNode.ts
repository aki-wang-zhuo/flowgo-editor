/**
 * JS 转换节点运行：用 configuration.debugValue 作为脚本 msg 入参。
 * mode=run 继续下游；mode=runOnly 只跑本节点。
 * debugValue 仅调试使用，真实部署 / 上游触发不会读取。
 */
import { ElMessage } from 'element-plus'
import { t } from '@/i18n'
import { simulateJsTransform } from '@/api/flow'
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

async function runJsTransformNode(ctx: NodeRunContext) {
  const model = ctx.lf.getNodeModelById?.(ctx.nodeId) as
    | {
        type?: string
        text?: { value?: string }
        properties?: Record<string, unknown>
      }
    | undefined
  if (!model || model.type !== 'jsTransform') {
    ElMessage.warning(t('runners.jsTransform.unsupported'))
    return
  }

  const body = readDebugValue(model.properties?.configuration)
  const nodeName =
    (model.properties?.name as string) || model.text?.value || t('runners.jsTransform.defaultName')
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
        ? t('runners.jsTransform.consoleStartOnly')
        : t('runners.jsTransform.consoleStart'),
    })
  }

  try {
    const res = await simulateJsTransform(ctx.flowId, {
      dsl: ctx.dsl,
      nodeId: ctx.nodeId,
      body,
      runOnly,
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
    ElMessage.success(
      runOnly ? t('runners.jsTransform.successOnly') : t('runners.jsTransform.success'),
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

/** 注册 JS 转换节点 runner */
export function registerJsTransformNodeRunner() {
  registerRunHandler({
    name: 'jsTransform-node',
    match: (ctx) => {
      if (ctx.kind !== 'node') return false
      const model = ctx.lf.getNodeModelById?.(ctx.nodeId)
      return model?.type === 'jsTransform'
    },
    run: async (ctx) => {
      if (ctx.kind !== 'node') return
      await runJsTransformNode(ctx)
    },
  })
}
