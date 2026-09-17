/** 画布交互：选路径 / 选分支 / JS 边 */
export const canvas = {
  pickHttp: {
    noPath: '没有可用的请求路径（每条路径只能连一条线）',
    title: '选择请求路径',
    hint: '请选择本连线对应的请求路径；取消将撤销连线',
    reselectTitle: '重新选择请求路径',
    reselectHint: '请选择本连线对应的请求路径；取消则保持原路径',
  },
  pickBranch: {
    noOutlet: '没有可用的分支出口（每个出口只能连一条线）',
    title: '选择分支出口',
    hint: '请选择本连线对应的分支出口；取消将撤销连线',
  },
  jsEdge: {
    cannotToggle: '已连接两条出边时不可切换结果',
    maxTwo: '最多两条出边（Success / Failure）',
    successLabel: 'Success（成功）',
    failureLabel: 'Failure（失败）',
    pickTitle: '选择执行结果',
    pickHint: '当前仅一条出边，可指定走成功或失败出口',
  },
  connection: {
    noSelfLoop: '不允许连接到自身（会造成死循环）',
    ioOnly: '请连接「出」与「入」：右侧对左侧（或从左侧拉到对方右侧）',
    entryNoIncoming: '入口节点无入边',
    exitNoOutgoing: '出口节点无出边',
    maxOutgoing: '出边数已达上限',
    noPortsNode: '该节点无连接端口，不能连线',
  },
  insertNode: {
    message:
      '是否将此节点插入到当前连线中？\n原连线将拆分为：上游 → 本节点 → 下游。',
    title: '插入节点',
    confirm: '插入',
  },
  minimap: {
    title: '导航',
    open: '打开小地图',
    close: '关闭',
    menuAria: '小地图菜单',
    fitAll: '显示所有',
    exportImage: '导出图片',
    exportOk: '已导出画布图片',
    exportSelectionOk: '已导出选中组件图片',
    exportEmpty: '画布为空，无法导出',
    exportNoPlugin: '导出插件未就绪',
    exportFailed: '导出图片失败',
  },
}
