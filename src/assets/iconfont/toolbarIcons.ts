/**
 * 画布快捷栏等处使用的 iconfont 类名映射（font_class，不含 icon- 前缀）。
 * 图标来源：src/assets/iconfont（FlowGo iconfont 项目）。
 */
export const ToolbarIcons = {
  /** 保存草稿 */
  save: 'baocun',
  /** 上线（unicode ec8d） */
  online: 'charulianjie',
  /** 下线（unicode ec8f） */
  offline: 'quxiaolianjie',
  /** 发布菜单 */
  publish: 'fabu',
  /** 刷新 */
  refresh: 'shuaxin',
  /** 自动布局（unicode ec89） */
  autoLayout: 'qiapianmoshi_kuai',
  /** 显示全部（unicode ec5d） */
  fitView: 'lianjieliu',
  /** 调试控制台（unicode eca5） */
  console: 'shebeikaifa',
} as const

export type ToolbarIconKey = keyof typeof ToolbarIcons
