/**
 * 收集画布上的 mqttIn 节点，供 MQTT 发「复用客户端」下拉使用。
 */
import type { LfInstance } from '@/canvas/lf-types'

export type MqttInOption = {
  id: string
  label: string
}

type GraphNode = {
  id?: string
  type?: string
  text?: { value?: string } | string
  properties?: { name?: string }
}

/** 从 LogicFlow 图数据列出 mqttIn 选项。 */
export function listMqttInOptions(
  lf: LfInstance | null | undefined,
  excludeNodeId?: string | null,
): MqttInOption[] {
  if (!lf) return []
  const data = (lf.getGraphData?.() || { nodes: [] }) as {
    nodes?: GraphNode[]
  }
  const out: MqttInOption[] = []
  for (const n of data.nodes || []) {
    if (!n?.id || n.type !== 'mqttIn') continue
    if (excludeNodeId && n.id === excludeNodeId) continue
    const name =
      (typeof n.properties?.name === 'string' && n.properties.name) ||
      (typeof n.text === 'string' ? n.text : n.text?.value) ||
      n.id
    out.push({ id: n.id, label: `${name} (${n.id})` })
  }
  return out
}
