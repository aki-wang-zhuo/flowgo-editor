/**
 * 注入执行入口：仅右侧出线；默认最多一条 Success 出边。
 * 运行请用节点浮动栏，出边不提供运行按钮。
 */
import { EndpointOnlyOutModel } from './endpointOnlyOut'
import { NodeRedView } from './nodeRedStyle'

/**
 * 注入执行专用模型。
 */
export class InjectModel extends EndpointOnlyOutModel {
  protected maxOutgoing(): number {
    return 1
  }
}

/** 复用 Node-RED 视图 */
export { NodeRedView as InjectView }
