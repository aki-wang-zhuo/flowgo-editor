/**
 * 注册 FlowGo 画布节点（LogicFlow）。
 * 入口节点仅右出、出口节点仅左入；中间节点左入右出。
 * 可从左侧拉到对方右侧，随后翻转为出→入；禁止自环。
 * httpEndpoint 出边受路径数限制；jsTransform / httpClient / mqttOut 最多两条（Success/Failure）。
 * mqttIn 为入口仅出。
 */
import LogicFlow from '@logicflow/core'
import { NodeRedModel, NodeRedView } from './nodes/nodeRedStyle'
import { HttpEndpointModel, HttpEndpointView } from './nodes/httpEndpointStyle'
import { HttpResponseModel, HttpResponseView } from './nodes/httpResponseStyle'
import { JsTransformModel, JsTransformView } from './nodes/jsTransformStyle'
import { InjectModel, InjectView } from './nodes/injectStyle'
import { MqttInModel, MqttInView } from './nodes/mqttInStyle'
import { GlobalVarsModel, GlobalVarsView } from './nodes/globalVarsStyle'
import { SingleIOModel, SingleIOView } from './nodes/singleIOStyle'
import {
  ConcurrentGroupModel,
  ConcurrentGroupView,
} from './nodes/concurrentGroupStyle'
import { flowEdge } from './edges/flowEdge'
import './nodes/nodeRed.css'

/**
 * 向 LogicFlow 实例注册业务节点类型。
 * @param types 后端返回的 type 列表；为空时至少注册 jsTransform 兜底
 */
export function registerFlowNodes(lf: LogicFlow, types: string[] = []) {
  const set = new Set(types.length ? types : ['jsTransform'])
  set.add('httpEndpoint')
  set.add('httpResponse')
  set.add('inject')
  set.add('mqttIn')
  set.add('mqttOut')
  set.add('jsTransform')
  set.add('httpClient')
  set.add('if')
  set.add('switch')
  set.add('globalVars')
  set.add('currentTime')
  set.add('concurrentGroup')

  for (const type of set) {
    if (type === 'httpEndpoint') {
      lf.register({
        type,
        view: HttpEndpointView,
        model: HttpEndpointModel,
      })
      continue
    }
    if (type === 'inject') {
      lf.register({
        type,
        view: InjectView,
        model: InjectModel,
      })
      continue
    }
    if (type === 'mqttIn') {
      lf.register({
        type,
        view: MqttInView,
        model: MqttInModel,
      })
      continue
    }
    if (type === 'httpResponse') {
      lf.register({
        type,
        view: HttpResponseView,
        model: HttpResponseModel,
      })
      continue
    }
    if (type === 'globalVars') {
      lf.register({
        type,
        view: GlobalVarsView,
        model: GlobalVarsModel,
      })
      continue
    }
    if (type === 'currentTime') {
      lf.register({
        type,
        view: SingleIOView,
        model: SingleIOModel,
      })
      continue
    }
    if (type === 'concurrentGroup') {
      lf.register({
        type,
        view: ConcurrentGroupView,
        model: ConcurrentGroupModel,
      })
      continue
    }
    // jsTransform / httpClient / mqttOut：共用双出边上限模型
    if (type === 'jsTransform' || type === 'httpClient' || type === 'mqttOut') {
      lf.register({
        type,
        view: JsTransformView,
        model: JsTransformModel,
      })
      continue
    }
    lf.register({
      type,
      view: NodeRedView,
      model: NodeRedModel,
    })
  }
  lf.register(flowEdge)
  lf.setDefaultEdgeType('bezier')
}
