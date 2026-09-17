/**
 * 连线调节手柄：默认隐藏，双击连线后才允许拖拽调整贝塞尔控制点。
 */
import { watch, type Ref } from 'vue'
import type { LfInstance } from './lf-types'

/**
 * 绑定到 LogicFlow：单击选中不显示手柄；双击开启 adjustEdge；点空白/节点后关闭。
 */
export function useEdgeAdjustOnDblClick(lf: Ref<LfInstance | null>) {
  let adjustingEdgeId: string | null = null

  function setAdjustEnabled(instance: LfInstance, enabled: boolean) {
    instance.updateEditConfig?.({ adjustEdge: enabled })
  }

  function disableAdjust(instance: LfInstance) {
    adjustingEdgeId = null
    setAdjustEnabled(instance, false)
  }

  function bind(instance: LfInstance) {
    // 初始关闭（与创建配置一致，再保险一次）
    setAdjustEnabled(instance, false)

    instance.on('edge:dbclick', ({ data }: { data: { id: string } }) => {
      adjustingEdgeId = data.id
      setAdjustEnabled(instance, true)
      // 确保该边处于选中态，BezierAdjustOverlay 才绘制手柄
      instance.selectElementById?.(data.id)
    })

    instance.on('edge:click', ({ data }: { data: { id: string } }) => {
      // 单击其它连线：退出调节态（仅选中，不显示手柄）
      if (adjustingEdgeId && adjustingEdgeId !== data.id) {
        disableAdjust(instance)
      }
    })

    instance.on('node:click', () => {
      disableAdjust(instance)
    })

    instance.on('blank:click', () => {
      disableAdjust(instance)
    })
  }

  watch(
    lf,
    (instance, _prev, onCleanup) => {
      if (!instance) return
      bind(instance)
      onCleanup(() => {
        adjustingEdgeId = null
      })
    },
    { immediate: true },
  )
}
