/**
 * HTTP 响应：仅左侧入线（出口节点无出边）。
 */
import { ExitOnlyInModel } from './exitOnlyIn'
import { NodeRedView } from './nodeRedStyle'

/**
 * HTTP 响应专用模型。
 */
export class HttpResponseModel extends ExitOnlyInModel {}

/** 复用 Node-RED 视图外观 */
export { NodeRedView as HttpResponseView }
