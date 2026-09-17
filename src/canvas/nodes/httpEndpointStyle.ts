/**
 * HTTP 入口节点：仅右侧出线；出边数不超过已配置路径数。
 */
import { EndpointOnlyOutModel } from './endpointOnlyOut'
import { readRouters, type HttpRouterItem } from '../httpRouter'
import { NodeRedView } from './nodeRedStyle'

/**
 * HTTP 入口专用模型。
 */
export class HttpEndpointModel extends EndpointOnlyOutModel {
  setAttributes() {
    super.setAttributes()
    this.text.y = this.y
  }

  /** 读取配置中的请求路径列表 */
  getRouters(): HttpRouterItem[] {
    return readRouters(this.properties?.configuration)
  }

  protected maxOutgoing(): number {
    return Math.max(1, this.getRouters().length)
  }
}

/** 复用 Node-RED 视图外观 */
export { NodeRedView as HttpEndpointView }
