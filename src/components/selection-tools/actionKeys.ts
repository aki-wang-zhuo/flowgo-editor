/**
 * 画布选中浮动操作栏的动作键。
 * 调用方可按需传入子集以控制显示哪些按钮及顺序。
 */
import { t } from '@/i18n'
import type { NodeToolbarActions } from '@/types/flow'

export type SelectionActionKey =
  | 'edit'
  | 'delete'
  | 'run'
  | 'runOnly'
  /** 重新选择 HTTP 请求路径（仅 HTTP 出边） */
  | 'pickPath'

/** 节点默认动作：编辑 / 删除 / 运行 / 仅运行此节点 */
export const NODE_DEFAULT_ACTIONS: SelectionActionKey[] = [
  'edit',
  'delete',
  'run',
  'runOnly',
]

/** 普通连线：删除 / 运行 / 编辑 */
export const EDGE_PATH_ACTIONS: SelectionActionKey[] = [
  'delete',
  'run',
  'edit',
]

/** 注入执行出边：仅删除 / 编辑（运行在节点浮动栏） */
export const EDGE_INJECT_ACTIONS: SelectionActionKey[] = ['delete', 'edit']

/** HTTP 入口出边：删除 / 运行 / 调试值 / 重选路径 */
export const EDGE_HTTP_ACTIONS: SelectionActionKey[] = [
  'delete',
  'run',
  'edit',
  'pickPath',
]

/** 分支节点出边：删除 / 运行 / 编辑源节点 / 重选分支 */
export const EDGE_BRANCH_ACTIONS: SelectionActionKey[] = [
  'delete',
  'run',
  'edit',
  'pickPath',
]

/** JS 转换单出边：删除 / 运行 / 编辑 / 切换 Success·Failure */
export const EDGE_JS_SINGLE_ACTIONS: SelectionActionKey[] = [
  'delete',
  'run',
  'edit',
  'pickPath',
]

const ACTION_I18N_KEYS: Record<SelectionActionKey, string> = {
  edit: 'selection.edit',
  delete: 'selection.delete',
  run: 'selection.run',
  runOnly: 'selection.runOnly',
  pickPath: 'selection.pickPath',
}

/** 各动作的默认 tooltip 文案（随当前语言变化） */
export function getActionTooltip(key: SelectionActionKey): string {
  return t(ACTION_I18N_KEYS[key])
}

/**
 * 按后端 NodeActions 过滤快捷按钮。
 * 默认全关；仅显式 true 的字段显示对应按钮。
 */
export function resolveNodeActions(
  caps: NodeToolbarActions | undefined | null,
  order: SelectionActionKey[] = NODE_DEFAULT_ACTIONS,
): SelectionActionKey[] {
  const a = caps || {}
  return order.filter((key) => {
    if (key === 'edit') return a.edit === true
    if (key === 'delete') return a.delete === true
    if (key === 'run') return a.run === true
    if (key === 'runOnly') return a.runOnly === true
    return false
  })
}
