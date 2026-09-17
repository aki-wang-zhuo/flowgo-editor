/**
 * 节点编辑器文档缓存：中文、英文各存一个「type → 文档」集合。
 * 切换语言只换读对应集合；内存里只保留当前语言那一份。
 */
import { ref, watch } from 'vue'
import {
  getComponentDoc,
  listComponentDocs,
  reloadComponentDocs,
} from '@/api/components'
import { currentLocale, type AppLocale } from '@/i18n'

function storageKey(locale: AppLocale): string {
  return `flowgo.componentDocs.${locale}`
}

/** 语言切换 / 强制刷新后递增，驱动文档页重填 */
export const componentDocVersion = ref(0)

/** 当前语言：type → markdown（仅这一份在内存） */
const cache = new Map<string, string>()

function readLocaleStore(locale: AppLocale): Record<string, string> {
  try {
    const raw = localStorage.getItem(storageKey(locale))
    if (!raw) return {}
    const obj = JSON.parse(raw) as Record<string, string>
    return obj && typeof obj === 'object' ? obj : {}
  } catch {
    return {}
  }
}

function writeLocaleStore(locale: AppLocale, data: Record<string, string>) {
  try {
    localStorage.setItem(storageKey(locale), JSON.stringify(data))
  } catch {
    // 配额满等忽略
  }
}

/** 把磁盘上的当前语言集合载入内存 */
function loadCurrentLocaleIntoMemory() {
  cache.clear()
  const obj = readLocaleStore(currentLocale.value)
  for (const [k, v] of Object.entries(obj)) {
    if (k) cache.set(k, typeof v === 'string' ? v : '')
  }
}

/** 把内存写回当前语言的集合 */
function persistCurrentLocale() {
  const obj: Record<string, string> = {}
  for (const [k, v] of cache) obj[k] = v
  writeLocaleStore(currentLocale.value, obj)
}

loadCurrentLocaleIntoMemory()

/** 切语言：换读另一套集合（不互相清空） */
watch(currentLocale, () => {
  loadCurrentLocaleIntoMemory()
  componentDocVersion.value += 1
})

/** 读当前语言集合中该 type；无则 null */
export function peekComponentDoc(type: string): string | null {
  const t = String(type || '').trim()
  if (!t || !cache.has(t)) return null
  return cache.get(t) as string
}

/**
 * 获取单节点文档。当前语言集合内同 type 优先缓存。
 * force：服务端 Reload 后清空当前语言集合再拉本 type。
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

  if (force) {
    try {
      await reloadComponentDocs()
    } catch (e) {
      console.warn('[componentDocs] reload failed', e)
    }
    cache.clear()
    writeLocaleStore(currentLocale.value, {})
  }

  const { doc } = await getComponentDoc(t)
  const text = doc ?? ''
  cache.set(t, text)
  persistCurrentLocale()
  if (force) componentDocVersion.value += 1
  return text
}

/**
 * 全量重载当前语言集合（其它语言集合不动）。
 * @returns 有正文的条数
 */
export async function refreshAllComponentDocs(): Promise<number> {
  await reloadComponentDocs()
  cache.clear()
  const { items } = await listComponentDocs()
  let n = 0
  for (const it of items || []) {
    const typ = String(it.type || '').trim()
    const text = String(it.doc || '')
    if (typ) cache.set(typ, text)
    if (text.trim()) n += 1
  }
  persistCurrentLocale()
  componentDocVersion.value += 1
  return n
}
