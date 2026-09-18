/**
 * 编辑器 ↔ 服务端 WebSocket：在线状态 + MCP/API 变更推送 + 激活流程查询应答。
 */
import { onUnmounted, ref, shallowRef, type Ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { t } from '@/i18n'
import type { FlowDSL } from '@/types/flow'

export type WsStatus = 'disconnected' | 'connecting' | 'connected'

export interface WsEnvelope {
  type: string
  payload?: unknown
  ts?: number
}

export interface FlowChangedPayload {
  action: 'saved' | 'deleted' | 'group' | string
  id: string
  name?: string
  source?: string
}

export interface EditorCommandPayload {
  action: 'refresh_canvas' | 'reload_flows' | 'open_flow' | string
  flowId?: string
}

/** 服务端询问当前激活流程 */
export interface EditorQueryPayload {
  requestId: string
  includeDsl?: boolean
}

/** 编辑器应答：当前激活 Tab 快照 */
export interface ActiveFlowReplyPayload {
  requestId: string
  active: boolean
  flowId?: string
  name?: string
  dirty?: boolean
  locked?: boolean
  revision?: number
  openIds?: string[]
  dsl?: FlowDSL
}

/** 服务端请求增量修改当前激活流程 */
export interface EditorPatchPayload {
  requestId: string
  flowId?: string
  includeDsl?: boolean
  patch: unknown
}

/** 编辑器应答：补丁应用结果 */
export interface PatchedFlowReplyPayload {
  requestId: string
  ok: boolean
  flowId?: string
  name?: string
  dirty?: boolean
  locked?: boolean
  revision?: number
  applied?: unknown
  errors?: Array<{ path: string; message: string }>
  dsl?: FlowDSL
  message?: string
}

export interface FlowDebugPayload {
  flowId: string
  logs?: Array<{
    ts?: number
    flowType?: string
    nodeId?: string
    nodeName?: string
    relationType?: string
    data?: string
    err?: string
    durationMs?: number
  }>
  error?: string
}

export interface UseServerWsHandlers {
  onFlowChanged?: (p: FlowChangedPayload) => void
  onEditorCommand?: (p: EditorCommandPayload) => void
  /** MQTT 等入口触发后推送的调试日志 */
  onFlowDebug?: (p: FlowDebugPayload) => void
  /** 收到 editor.query 时由工作区组装应答并通过 sendActiveFlow 回传 */
  onEditorQuery?: (p: EditorQueryPayload) => void
  /** 收到 editor.patch 时应用增量补丁并通过 sendPatchedFlow 回传 */
  onEditorPatch?: (p: EditorPatchPayload) => void
  /**
   * 断线重连前调用；返回 false 则停止重连（如 MCP 已关闭）。
   * 默认允许重连。
   */
  canReconnect?: () => boolean | Promise<boolean>
}

function buildWsURL(token: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  // 开发期走 Vite 同源代理 /api → 后端
  return `${proto}//${window.location.host}/api/ws?token=${encodeURIComponent(token)}`
}

/**
 * 登录后建立长连接；断线指数退避重连。
 */
export function useServerWs(handlers: UseServerWsHandlers = {}) {
  const auth = useAuthStore()
  const status: Ref<WsStatus> = ref('disconnected')
  const lastError = ref('')
  const socket = shallowRef<WebSocket | null>(null)

  let closedByUser = false
  let retry = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function disconnect() {
    closedByUser = true
    clearTimer()
    if (socket.value) {
      try {
        socket.value.close()
      } catch {
        /* ignore */
      }
      socket.value = null
    }
    status.value = 'disconnected'
  }

  /** 向服务端发送 JSON 信封（连接未就绪时静默失败） */
  function send(envelope: { type: string; payload?: unknown }) {
    const ws = socket.value
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    try {
      ws.send(JSON.stringify(envelope))
      return true
    } catch {
      return false
    }
  }

  /** 应答 get_active_flow 查询 */
  function sendActiveFlow(payload: ActiveFlowReplyPayload) {
    return send({ type: 'editor.active', payload })
  }

  /** 应答 patch_active_flow */
  function sendPatchedFlow(payload: PatchedFlowReplyPayload) {
    return send({ type: 'editor.patched', payload })
  }

  /**
   * 上报当前打开的流程 Tab 列表，供服务端挂载/释放草稿 MQTT「连接并响应」。
   * 关闭全部 Tab 时应传空数组以释放草稿连接。
   */
  function sendOpenFlows(openIds: string[]) {
    return send({ type: 'editor.open_flows', payload: { openIds: openIds || [] } })
  }

  function connect() {
    const token = auth.token
    if (!token) {
      disconnect()
      return
    }
    closedByUser = false
    clearTimer()
    if (socket.value && (socket.value.readyState === WebSocket.OPEN || socket.value.readyState === WebSocket.CONNECTING)) {
      return
    }
    status.value = 'connecting'
    lastError.value = ''
    const ws = new WebSocket(buildWsURL(token))
    socket.value = ws

    ws.onopen = () => {
      status.value = 'connected'
      retry = 0
    }
    ws.onclose = () => {
      socket.value = null
      status.value = 'disconnected'
      if (closedByUser || !auth.token) return
      void (async () => {
        if (handlers.canReconnect) {
          try {
            const ok = await handlers.canReconnect()
            if (!ok) return
          } catch {
            /* 检查失败时仍尝试重连 */
          }
        }
        const delay = Math.min(1000 * 2 ** retry, 15000)
        retry += 1
        timer = setTimeout(connect, delay)
      })()
    }
    ws.onerror = () => {
      lastError.value = t('workspace.wsConnectFailed')
    }
    ws.onmessage = (ev) => {
      let msg: WsEnvelope
      try {
        msg = JSON.parse(String(ev.data)) as WsEnvelope
      } catch {
        return
      }
      if (msg.type === 'flow.changed' && handlers.onFlowChanged) {
        handlers.onFlowChanged((msg.payload || {}) as FlowChangedPayload)
      }
      if (msg.type === 'flow.debug' && handlers.onFlowDebug) {
        handlers.onFlowDebug((msg.payload || {}) as FlowDebugPayload)
      }
      if (msg.type === 'editor.command' && handlers.onEditorCommand) {
        handlers.onEditorCommand((msg.payload || {}) as EditorCommandPayload)
      }
      if (msg.type === 'editor.query' && handlers.onEditorQuery) {
        handlers.onEditorQuery((msg.payload || {}) as EditorQueryPayload)
      }
      if (msg.type === 'editor.patch' && handlers.onEditorPatch) {
        handlers.onEditorPatch((msg.payload || {}) as EditorPatchPayload)
      }
    }
  }

  onUnmounted(disconnect)

  return {
    status,
    lastError,
    connect,
    disconnect,
    send,
    sendActiveFlow,
    sendPatchedFlow,
    sendOpenFlows,
  }
}
