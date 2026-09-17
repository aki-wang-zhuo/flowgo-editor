/**
 * 组件目录缓存：面板与画布注册共用同一份后端数据。
 * 切换语言后需 invalidate + 强制重新拉取。
 */
import { ref } from 'vue'
import { listComponents } from '@/api/components'
import type { NodeToolbarActions, PaletteGroup, PaletteItem } from '@/types/flow'

let cache: PaletteGroup[] | null = null
let loading: Promise<PaletteGroup[]> | null = null

/** 缓存版本：拉取成功后递增，供属性面板等依赖响应式刷新 */
export const catalogVersion = ref(0)

/** 清空缓存（语言切换后调用） */
export function invalidateComponentCatalog() {
  cache = null
  loading = null
}

/** 拉取组件分组（进程内缓存；失败抛错由调用方处理） */
export async function loadComponentGroups(force = false): Promise<PaletteGroup[]> {
  if (!force && cache) return cache
  if (!force && loading) return loading
  loading = listComponents()
    .then((groups) => {
      cache = groups
      catalogVersion.value += 1
      return groups
    })
    .finally(() => {
      loading = null
    })
  return loading
}

/** 已缓存的节点 type 列表（未加载则为空） */
export function cachedComponentTypes(): string[] {
  if (!cache) return []
  return cache.flatMap((g) => g.items.map((i) => i.type))
}

/** 按 type 取面板元数据（颜色、图标、快捷栏能力等） */
export function cachedComponentMeta(type: string): PaletteItem | null {
  if (!cache) return null
  for (const g of cache) {
    const item = g.items.find((i) => i.type === type)
    if (item) return item
  }
  return null
}

/** 读取某类型的快捷栏能力（缺省空对象 = 全部关闭） */
export function cachedNodeActions(type: string): NodeToolbarActions {
  return cachedComponentMeta(type)?.actions || {}
}
