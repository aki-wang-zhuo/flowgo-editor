/**
 * 中文（简体）词条汇总。
 */
import { common } from './common'
import { auth } from './auth'
import { workspace } from './workspace'
import { flows } from './flows'
import { forms } from './forms'
import { canvas } from './canvas'
import { settings } from './settings'
import { runners } from './runners'

export const zhCN = {
  common,
  auth,
  workspace,
  tabBar: {
    ariaLabel: '流程标签',
    lockedSuffix: '（已锁定）',
    unpublishedSuffix: '（未发布）',
    unpublishedChangesSuffix: '（有未发布改动）',
    renameHintSuffix: '（双击改名）',
    closeAria: '关闭 {title}',
    newFlow: '新建流程',
    emptyHint: '点击 + 新建，或从左侧打开流程',
  },
  leftDock: {
    flows: '我的流程',
    nodes: '节点',
  },
  flows,
  createFlow: {
    title: '新建流程',
    name: '流程名称',
    group: '所属分组',
    groupPlaceholder: '未分组',
  },
  nodePalette: {
    lockHint: '流程已锁定，无法添加节点',
    searchPlaceholder: '搜索节点',
    expandAll: '展开全部分组',
    collapseAll: '收起全部分组',
    loadFailed: '组件目录加载失败',
    emptyMatch: '没有匹配的节点',
    empty: '暂无节点',
    tip: '拖到画布添加；Alt+拖拽框选',
    defaultBranchA: '分支 A',
    defaultBranchB: '分支 B',
  },
  propertyPanel: {
    title: '属性',
    titleLocked: '属性（已锁定）',
    type: '类型',
    name: '名称',
    debug: '调试',
    debugHint: '开启后运行时将该节点的请求与结果输出到控制台',
    empty: '选中画布上的节点以编辑属性',
    noConfigFields: '该节点暂无配置项',
  },
  forms,
  canvas,
  quickToolbar: {
    aria: '画布快捷栏',
    saveLocked: '流程已锁定，无法保存',
    saveDirty: '保存草稿 * (Ctrl+S)',
    save: '保存草稿 (Ctrl+S)',
    publish: '发布到线上',
    publishMenu: '发布相关',
    publishLocked: '流程已锁定，无法发布',
    discard: '放弃草稿（恢复为已发布）',
    history: '发布历史',
    refresh: '从服务器刷新当前流程 (Ctrl+Shift+R)',
    fitView: '显示全部节点',
    hideConsole: '隐藏控制台',
    showConsole: '显示控制台',
  },
  console: {
    resize: '拖动调整控制台高度',
    title: '调试控制台',
    autoClearTooltip: '开启后，每次调试运行前自动清空日志',
    autoClear: '自动清空',
    clear: '清空日志',
    close: '关闭控制台',
    empty: '暂无调试数据',
  },
  runError: {
    title: '节点运行失败',
    close: '关闭',
  },
  selection: {
    aria: '选中操作',
    nodeAria: '节点操作',
    edgeAria: '连线操作',
    edit: '修改',
    delete: '删除',
    run: '运行（含下游）',
    runOnly: '仅运行此节点',
    pickPath: '重新选择请求路径',
    edgeDelete: '删除连线',
    edgeEditDebug: '编辑调试值',
    edgeEditSource: '编辑（打开所属节点属性）',
    edgeReselectPath: '重新选择请求路径',
    edgeReselectBranch: '重新选择分支',
    edgeToggleResult: '切换 Success / Failure',
  },
  settings,
  userMenu: {
    account: '账户',
    fallbackUser: '用户',
    role: '角色：{role}',
    changePassword: '修改密码',
    logout: '退出登录',
    oldPassword: '旧密码',
    newPassword: '新密码',
    passwordChanged: '密码已修改',
    changeFailed: '修改失败',
    language: '语言',
  },
  runners,
}
