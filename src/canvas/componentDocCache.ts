/**
 * 节点编辑器文档：始终从服务端内存库读取（经 API），不使用 localStorage。
 * 刷新时先请求服务端 Reload，再拉当前节点文档。
 */
import { ref } from 'vue'
import {
  getComponentDoc,
  listComponentDocs,
  reloadComponentDocs,
} from '@/api/components'

/** 版本号：拉取成功后递增，驱动文档页刷新 */
export const componentDocVersion = ref(0)

/**
 * 从服务端获取单节点文档。
 * @param force 为 true 时先触发服务端 Reload 再读
 */
export async function loadComponentDoc(
  type: string,
  force = false,
): Promise<string> {
  const t = String(type || '').trim()
  if (!t) return ''
  if (force) {
    try {
      await reloadComponentDocs()
    } catch (e) {
      console.warn('[componentDocs] reload failed', e)
    }
  }
  const { doc } = await getComponentDoc(t)
  componentDocVersion.value += 1
  return doc ?? ''
}

/**
 * 通知服务端重载磁盘 MD 到内存，并拉取全部文档（用于面板刷新提示条数）。
 * @returns 有正文的文档条数
 */
export async function refreshAllComponentDocs(): Promise<number> {
  await reloadComponentDocs()
  const { items } = await listComponentDocs()
  let n = 0
  for (const it of items || []) {
    if (String(it.doc || '').trim()) n += 1
  }
  componentDocVersion.value += 1
  return n
}
