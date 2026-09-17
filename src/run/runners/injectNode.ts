/**
 * 注入执行节点运行：把 payload 写入消息并从该节点执行后续链路。
 * 节点开启调试时，IN/OUT 只采用服务端 DebugLog；关闭调试时控制台不出现本节点任何日志。
 */
import { ElMessage } from 'element-plus'
import { t } from '@/i18n'
import { simulateInject } from '@/api/flow'
import {
  appendConsoleLog,
  appendServerDebugLogs,
  prepareConsoleForRun,
} from '@/console/useEditorConsole'
import { applyRunResultErrors, clearRunErrors } from '../runErrorHighlight'
import { registerRunHandler } from '../registry'
import type { NodeRunContext } from '../types'

function readPayload(configuration: unknown): string {
  const conf = (configuration || {}) as Record<string, unknown>
  const s = String(conf.payload || '').trim()
  return s || '{}'
}

async function runInjectNode(ctx: NodeRunContext) {
  const model = ctx.lf.getNodeModelById?.(ctx.nodeId) as
    | {
        type?: string
        text?: { value?: string }
        properties?: Record<string, unknown>
      }
    | undefined
  if (!model || model.type !== 'inject') {
    ElMessage.warning(t('runners.inject.unsupported'))
    return
  }

  const payload = readPayload(model.properties?.configuration)
  const nodeName =
    (model.properties?.name as string) || model.text?.value || t('runners.inject.defaultName')
  const debug = !!model.properties?.debug

  clearRunErrors(ctx.lf)
  prepareConsoleForRun()
  // 未开调试：控制台不出现本节点任何日志；开调试时 IN/OUT 由引擎返回
  if (debug) {
    appendConsoleLog({
      flowType: 'INFO',
      nodeId: ctx.nodeId,
      nodeName,
      data: t('runners.inject.consoleStart'),
    })
  }

  try {
    const res = await simulateInject(ctx.flowId, {
      dsl: ctx.dsl,
      nodeId: ctx.nodeId,
      body: payload,
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
    ElMessage.success(t('runners.inject.success'))
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

/** 注册注入执行节点 runner */
export function registerInjectNodeRunner() {
  registerRunHandler({
    name: 'inject-node',
    match: (ctx) => {
      if (ctx.kind !== 'node') return false
      if (ctx.mode !== 'run') return false
      const model = ctx.lf.getNodeModelById?.(ctx.nodeId)
      return model?.type === 'inject'
    },
    run: async (ctx) => {
      if (ctx.kind !== 'node') return
      await runInjectNode(ctx)
    },
  })
}
