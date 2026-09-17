/** 调试运行 / runner 提示 */
export const runners = {
  noRunner: '当前对象暂无可用的运行方式',
  inject: {
    unsupported: '仅支持注入执行节点',
    defaultName: '注入执行',
    consoleStart: '注入执行：写入 payload 并运行后续节点',
    success: '注入执行完成',
  },
  httpClient: {
    unsupported: '仅支持 HTTP 客户端节点',
    defaultName: 'HTTP客户端',
    consoleStart: 'HTTP 客户端调试：使用测试值作为上游消息并执行',
    success: 'HTTP 客户端执行完成',
  },
  httpEndpoint: {
    unsupported: '仅支持从 HTTP 请求节点的路径连线运行',
    pathNotFound: '未找到对应请求路径',
    defaultName: 'HTTP请求',
    consoleStart: '模拟请求 {method} {path}',
    success: '模拟请求已完成',
  },
  jsTransform: {
    unsupported: '仅支持 JS 转换节点',
    defaultName: 'JS 转换',
    consoleStart: 'JS 转换调试：使用测试值作为脚本入参并执行',
    success: 'JS 转换执行完成',
  },
}
