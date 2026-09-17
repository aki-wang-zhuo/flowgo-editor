/**
 * HTTP 入口节点在画布上的路由辅助（与后端 RouterRelation / RouterLabel 对齐）。
 */
export interface HttpRouterItem {
  name?: string
  method: string
  path: string
  /** 调试用 JSON 文本；真实请求不使用 */
  debugValue?: string
}

/** 规范化 HTTP 方法 */
export function normalizeMethod(method: string | undefined): string {
  return (method || 'POST').toUpperCase().trim() || 'POST'
}

/** 规范化路径（保证以 / 开头） */
export function normalizePath(path: string | undefined): string {
  let p = (path || '/').trim() || '/'
  if (!p.startsWith('/')) p = '/' + p
  return p
}

/** 出边 relation / 唯一键：METHOD + 空格 + path */
export function routerRelation(r: HttpRouterItem): string {
  return `${normalizeMethod(r.method)} ${normalizePath(r.path)}`
}

/**
 * 连线展示：有自定义名称用名称；否则「METHOD /path」（与 relation 同形）。
 */
export function routerLabel(r: HttpRouterItem): string {
  const n = (r.name || '').trim()
  if (n) return n
  return routerRelation(r)
}

/**
 * 路径选择弹窗选项文案：有名称时附带 METHOD path，避免与标签重复。
 */
export function routerPickLabel(r: HttpRouterItem): string {
  const n = (r.name || '').trim()
  const key = routerRelation(r)
  if (n) return `${n}（${key}）`
  return key
}

/** 从节点 configuration 读取 routers */
export function readRouters(configuration: unknown): HttpRouterItem[] {
  const conf = (configuration || {}) as Record<string, unknown>
  const raw = conf.routers
  if (!Array.isArray(raw) || !raw.length) {
    return [{ method: 'POST', path: '/api/demo', debugValue: '{}' }]
  }
  return raw.map((item) => {
    const r = (item || {}) as Record<string, unknown>
    return {
      name: String(r.name || ''),
      method: normalizeMethod(String(r.method || 'POST')),
      path: normalizePath(String(r.path || '/')),
      debugValue: String(r.debugValue || '{}'),
    }
  })
}

/**
 * 检查 routers 中是否存在相同 method+path。
 * @param excludeIndex 可选：只检查该行是否与其它行冲突
 * @returns 冲突的键（如 "POST /api"）或 null
 */
export function findDuplicateRouterKey(
  routers: HttpRouterItem[],
  excludeIndex?: number,
): string | null {
  if (excludeIndex != null) {
    const row = routers[excludeIndex]
    if (!row) return null
    const key = routerRelation(row)
    for (let i = 0; i < routers.length; i++) {
      if (i === excludeIndex) continue
      if (routerRelation(routers[i]) === key) return key
    }
    return null
  }
  const seen = new Set<string>()
  for (const r of routers) {
    const key = routerRelation(r)
    if (seen.has(key)) return key
    seen.add(key)
  }
  return null
}

/** 右侧唯一出线锚点 id（不含节点 id 前缀） */
export const HTTP_OUT_ANCHOR = 'http-out'

/** 右侧出线锚点局部 id */
export function httpOutAnchorId(): string {
  return HTTP_OUT_ANCHOR
}
