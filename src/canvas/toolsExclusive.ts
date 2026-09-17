/**
 * 画布浮动操作栏互斥：节点 / 连线同一时刻只能有一个持有者。
 * claim 会覆盖上一位；release 仅在仍是本人时清空。
 */
export type CanvasToolsKind = 'node' | 'edge'

export interface CanvasToolsOwner {
  kind: CanvasToolsKind
  id: string
  /** 递增世代，避免过期 hide 误清新持有者 */
  gen: number
}

type Listener = (owner: CanvasToolsOwner | null) => void

let owner: CanvasToolsOwner | null = null
let nextGen = 1
const listeners = new Set<Listener>()

function notify() {
  const snap = owner
  listeners.forEach((fn) => {
    try {
      fn(snap)
    } catch {
      /* 忽略监听方异常，避免一条拖垮全部 */
    }
  })
}

/** 当前持有者（只读快照） */
export function getCanvasToolsOwner(): CanvasToolsOwner | null {
  return owner
}

/**
 * 声明持有操作栏；返回本次世代号，hide 时需带回。
 */
export function claimCanvasTools(kind: CanvasToolsKind, id: string): number {
  const gen = nextGen++
  owner = { kind, id, gen }
  notify()
  return gen
}

/**
 * 释放持有。仅当 kind/id/gen 仍匹配时清空，避免旧定时器误伤。
 */
export function releaseCanvasTools(
  kind: CanvasToolsKind,
  id: string,
  gen: number,
): void {
  if (!owner) return
  if (owner.kind !== kind || owner.id !== id || owner.gen !== gen) return
  owner = null
  notify()
}

/** 是否仍是指定持有者 */
export function isCanvasToolsOwner(
  kind: CanvasToolsKind,
  id: string,
  gen: number,
): boolean {
  return (
    !!owner &&
    owner.kind === kind &&
    owner.id === id &&
    owner.gen === gen
  )
}

/** 订阅持有者变化；返回取消订阅函数 */
export function subscribeCanvasTools(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
