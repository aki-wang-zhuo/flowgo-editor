/**
 * 节点编辑器文档本地缓存（localStorage）。
 * 与 MCP Usage 无关；按语言分桶，刷新时整桶覆盖。
 */
import { ref } from 'vue'
import {
  getComponentDoc,
  listComponentDocs,
} from '@/api/components'
import { currentLocale, type AppLocale } from '@/i18n'

const STORAGE_PREFIX = 'flowgo.componentDocs.v1.'

/** 缓存版本：写入后递增，供文档页响应式刷新 */
export const componentDocVersion = ref(0)

type DocMap = Record<string, string>

function storageKey(locale: AppLocale = currentLocale.value): string {
  return STORAGE_PREFIX + locale
}

function readBucket(locale?: AppLocale): DocMap {
  try {
    const raw = localStorage.getItem(storageKey(locale))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as DocMap
  } catch {
    return {}
  }
}

function writeBucket(map: DocMap, locale?: AppLocale) {
  try {
    localStorage.setItem(storageKey(locale), JSON.stringify(map))
  } catch (e) {
    console.warn('[componentDocCache] write failed', e)
  }
  componentDocVersion.value += 1
}

/** 读本地缓存中某类型文档；无则 null */
export function peekComponentDoc(
  type: string,
  locale?: AppLocale,
): string | null {
  const t = String(type || '').trim()
  if (!t) return null
  const bucket = readBucket(locale)
  if (!(t in bucket)) return null
  return bucket[t] ?? ''
}

/** 写入单条文档到本地缓存 */
export function putComponentDoc(
  type: string,
  doc: string,
  locale?: AppLocale,
) {
  const t = String(type || '').trim()
  if (!t) return
  const bucket = readBucket(locale)
  bucket[t] = doc ?? ''
  writeBucket(bucket, locale)
}

/**
 * 获取节点文档：优先本地缓存；force 或未命中则请求服务端并写入缓存。
 */
export async function loadComponentDoc(
  type: string,
  force = false,
): Promise<string> {
  const t = String(type || '').trim()
  if (!t) return ''
  if (!force) {
    const hit = peekComponentDoc(t)
    if (hit != null) return hit
  }
  const { doc } = await getComponentDoc(t)
  putComponentDoc(t, doc)
  return doc
}

/**
 * 从服务端拉取全部文档并覆盖当前语言下的本地缓存。
 * @returns 覆盖条数
 */
export async function refreshAllComponentDocs(): Promise<number> {
  const { items } = await listComponentDocs()
  const next: DocMap = {}
  for (const it of items || []) {
    const t = String(it.type || '').trim()
    if (!t) continue
    next[t] = it.doc ?? ''
  }
  writeBucket(next)
  return Object.keys(next).length
}

/** 清空当前语言文档缓存（语言切换时可选用） */
export function clearComponentDocCache(locale?: AppLocale) {
  try {
    localStorage.removeItem(storageKey(locale))
  } catch {
    /* ignore */
  }
  componentDocVersion.value += 1
}
