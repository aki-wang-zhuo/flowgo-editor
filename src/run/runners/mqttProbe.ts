/**
 * MQTT 收 / 发节点：浮动栏「测试」——短暂连接探测，测完即断开。
 */
import { ElMessage } from 'element-plus'
import { t } from '@/i18n'
import { probeMqtt } from '@/api/flow'
import {
  appendConsoleLog,
  prepareConsoleForRun,
} from '@/console/useEditorConsole'
import { registerRunHandler } from '../registry'
import type { NodeRunContext } from '../types'

function nodeConfig(ctx: NodeRunContext): Record<string, unknown> {
  const model = ctx.lf.getNodeModelById?.(ctx.nodeId) as
    | { properties?: { configuration?: Record<string, unknown> } }
    | undefined
  return { ...(model?.properties?.configuration || {}) }
}

function findMqttInConfig(
  ctx: NodeRunContext,
  reuseFrom: string,
): Record<string, unknown> | undefined {
  if (!reuseFrom) return undefined
  const model = ctx.lf.getNodeModelById?.(reuseFrom) as
    | {
        type?: string
        properties?: { configuration?: Record<string, unknown> }
      }
    | undefined
  if (!model || model.type !== 'mqttIn') return undefined
  return { ...(model.properties?.configuration || {}) }
}

async function runMqttProbe(ctx: NodeRunContext) {
  const model = ctx.lf.getNodeModelById?.(ctx.nodeId) as
    | {
        type?: string
        properties?: { name?: string; configuration?: Record<string, unknown> }
        text?: { value?: string }
      }
    | undefined
  if (!model || (model.type !== 'mqttIn' && model.type !== 'mqttOut')) {
    ElMessage.warning(t('runners.mqtt.unsupported'))
    return
  }
  const name =
    (model.properties?.name as string) ||
    model.text?.value ||
    t('runners.mqtt.defaultName')
  const configuration = nodeConfig(ctx)
  const kind = model.type === 'mqttIn' ? 'subscribe' : 'publish'

  prepareConsoleForRun()
  appendConsoleLog({
    flowType: 'INFO',
    nodeId: ctx.nodeId,
    nodeName: name,
    data: t('runners.mqtt.consoleStart', { name }),
  })

  try {
    let reuseConfiguration: Record<string, unknown> | undefined
    if (kind === 'publish') {
      const reuseFrom = String(configuration.reuseFrom || '').trim()
      if (reuseFrom) {
        reuseConfiguration = findMqttInConfig(ctx, reuseFrom)
        if (!reuseConfiguration) {
          ElMessage.error(t('runners.mqtt.reuseMissing'))
          return
        }
      }
    }
    const res = await probeMqtt(ctx.flowId, {
      kind,
      configuration,
      reuseConfiguration,
    })
    appendConsoleLog({
      flowType: res.ok ? 'INFO' : 'ERROR',
      nodeId: ctx.nodeId,
      nodeName: name,
      data: res.message,
      err: res.ok ? undefined : res.message,
    })
    if (res.ok) {
      ElMessage.success(res.message)
    } else {
      ElMessage.error(res.message)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    appendConsoleLog({
      flowType: 'ERROR',
      nodeId: ctx.nodeId,
      nodeName: name,
      data: msg,
      err: msg,
    })
    ElMessage.error(msg)
  }
}

/** 注册 MQTT 测试 runner（mode=test） */
export function registerMqttProbeRunner() {
  registerRunHandler(
    {
      name: 'mqtt-probe',
      match: (ctx) => {
        if (ctx.kind !== 'node' || ctx.mode !== 'test') return false
        const model = ctx.lf.getNodeModelById?.(ctx.nodeId) as
          | { type?: string }
          | undefined
        return model?.type === 'mqttIn' || model?.type === 'mqttOut'
      },
      run: async (ctx) => {
        await runMqttProbe(ctx as NodeRunContext)
      },
    },
    true,
  )
}
