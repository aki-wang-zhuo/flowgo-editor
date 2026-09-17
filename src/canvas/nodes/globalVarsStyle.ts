/**
 * 全局变量节点：无端口样式（复用 Node-RED 外观 + NoPortsModel）。
 */
import { NoPortsModel, NoPortsView } from './noPorts'

export class GlobalVarsModel extends NoPortsModel {}
export { NoPortsView as GlobalVarsView }
