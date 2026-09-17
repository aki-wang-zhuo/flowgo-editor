/**
 * FlowGo 自有流程图 DSL 类型（与后端 api/types/flow.go 对齐）。
 */
export interface FlowDSL {
  id: string
  name: string
  description?: string
  version?: number
  entryNode: string
  nodes: FlowNode[]
  edges: FlowEdge[]
}

export interface FlowNode {
  id: string
  type: string
  name?: string
  /** 开启后调试运行会把该节点入/出消息打到控制台，默认 false */
  debug?: boolean
  /** 画布坐标，引擎执行忽略 */
  x?: number
  y?: number
  configuration?: Record<string, unknown>
}

export interface FlowEdge {
  from: string
  to: string
  relation?: string
  /** 贝塞尔控制点（画布布局，引擎忽略） */
  pointsList?: Array<{ x: number; y: number }>
}

/** 属性面板 / 拖拽默认值用的配置字段（与后端 ConfigField 对齐） */
export interface ConfigField {
  name: string
  /** string | number | boolean | object | array */
  type: string
  required?: boolean
  default?: string
  description?: string
  /** 开关旁补充说明 */
  hint?: string
  /**
   * text | textarea | code-json | code-js | switch | number | select | router-list | var-list | case-list；
   * 空则按 type 推断。routers 数组即使标 code-json 也会被前端识别为 router-list。
   */
  widget?: string
  rows?: number
  /** 条件显示，如 https=true */
  showIf?: string
  /** 下拉选项（widget=select） */
  options?: Array<{ value: string; label: string }>
}

/** 节点面板单项 */
export interface PaletteItem {
  type: string
  label: string
  defaultScript?: string
  /** 图标区字符，默认 ƒ */
  iconText?: string
  /** Node-RED 风格填充色（同组统一） */
  color?: string
  description?: string
  /** 画布选中快捷栏能力（默认全关，仅 true 显示） */
  actions?: NodeToolbarActions
  /** 动态属性表单字段（后端下发） */
  configFields?: ConfigField[]
  /** 左侧入端口数量（0=无入） */
  inPorts?: number
  /** 右侧出端口数量（0=无出；JS 转换视觉为 1，可连两条边） */
  outPorts?: number
}

/** 后端声明的节点快捷栏能力（省略即关闭） */
export interface NodeToolbarActions {
  edit?: boolean
  delete?: boolean
  run?: boolean
  runOnly?: boolean
}

/** 节点分组（侧栏折叠） */
export interface PaletteGroup {
  id: string
  label: string
  items: PaletteItem[]
}
