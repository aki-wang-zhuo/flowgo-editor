/**
 * MQTT 收：仅右侧出线；默认最多一条 Success 出边。
 */
import { EndpointOnlyOutModel } from './endpointOnlyOut'
import { NodeRedView } from './nodeRedStyle'

/**
 * MQTT 收入口模型。
 */
export class MqttInModel extends EndpointOnlyOutModel {
  protected maxOutgoing(): number {
    return 1
  }
}

/** 复用 Node-RED 视图 */
export { NodeRedView as MqttInView }
