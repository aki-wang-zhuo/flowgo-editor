/**
 * HTTP 入口节点在画布上的路由辅助（与后端 RouterRelation / RouterLabel 对齐）。
 * 同时供动态属性表单解析 / 结构化编辑 [{method,path,name?,debugValue?}]。
 */
export interface HttpRouterItem {
  name?: string
  method: string
  path: string
  /** 调试用 JSON 文本；真实请求不使用 */
  debugValue?: string
}

/** 属性面板方法下拉可选值 */
export const HTTP_ROUTER_METHODS = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
] as const

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

/**
 * 将单条未知数据规范为 HttpRouterItem（缺字段补默认）。
 */
export function normalizeRouterItem(item: unknown): HttpRouterItem {
  const r = (item && typeof item === 'object' && !Array.isArray(item)
    ? item
    : {}) as Record<string, unknown>
  return {
    name: String(r.name ?? ''),
    method: normalizeMethod(String(r.method ?? 'POST')),
    path: normalizePath(String(r.path ?? '/')),
    debugValue: String(r.debugValue ?? '{}') || '{}',
  }
}

/**
 * 判定对象是否像路由项（至少带 method 或 path，供 schema / default 识别）。
 */
export function isRouterLikeItem(v: unknown): boolean {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false
  const o = v as Record<string, unknown>
  return (
    Object.prototype.hasOwnProperty.call(o, 'method') ||
    Object.prototype.hasOwnProperty.call(o, 'path')
  )
}

/**
 * 解析路由列表：支持数组，或 JSON 字符串；空则给一条默认路由。
 * 动态表单 / 画布 / 运行侧统一走此入口，避免各处重复 JSON.parse。
 */
export function parseRouterList(raw: unknown): HttpRouterItem[] {
  let list: unknown = raw
  if (typeof raw === 'string') {
    const text = raw.trim()
    if (!text) {
      return [createDefaultRouterItem()]
    }
    try {
      list = JSON.parse(text) as unknown
    } catch {
      return [createDefaultRouterItem()]
    }
  }
  if (!Array.isArray(list) || !list.length) {
    return [createDefaultRouterItem()]
  }
  return list.map((item) => normalizeRouterItem(item))
}

/** 新建一条默认可编辑路由（POST /api/demo） */
export function createDefaultRouterItem(): HttpRouterItem {
  return {
    name: '',
    method: 'POST',
    path: '/api/demo',
    debugValue: '{}',
  }
}

/**
 * 写回 configuration 前规范化整表（去空白、统一 method/path、保证至少一行）。
 */
export function normalizeRouterList(routers: HttpRouterItem[]): HttpRouterItem[] {
  const list = (routers?.length ? routers : [createDefaultRouterItem()]).map(
    (r) => normalizeRouterItem(r),
  )
  return list.map((r) => ({
    ...r,
    name: (r.name || '').trim(),
    debugValue: (r.debugValue || '{}').trim() || '{}',
  }))
}

/**
 * 追加路由时生成不与现有 method+path 冲突的 path。
 */
export function nextUniqueRouterPath(
  routers: HttpRouterItem[],
  method = 'POST',
): string {
  let path = '/api/'
  let n = 1
  while (
    findDuplicateRouterKey([
      ...routers,
      { method, path, debugValue: '{}' },
    ])
  ) {
    path = `/api/path${n}`
    n += 1
    if (n > 99) break
  }
  return path
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

/** 从节点 configuration 读取 routers（走公共 parseRouterList） */
export function readRouters(configuration: unknown): HttpRouterItem[] {
  const conf = (configuration || {}) as Record<string, unknown>
  return parseRouterList(conf.routers)
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
