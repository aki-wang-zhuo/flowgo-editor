/**
 * 连线时 / 重绑时选择 HTTP 请求路径（仅展示未占用项；取消返回 null）。
 */
import { h, ref } from 'vue'
import { ElMessage, ElMessageBox, ElRadio, ElRadioGroup } from 'element-plus'
import { routerPickLabel, type HttpRouterItem } from './httpRouter'
import { t } from '@/i18n'

export interface HttpRouterPickOption {
  index: number
  router: HttpRouterItem
}

export interface PickHttpRouterOptions {
  /** 弹窗标题 */
  title?: string
  /** 顶部说明文案 */
  hint?: string
  /** 预选项（须在 free 中） */
  preferredIndex?: number
}

/**
 * 弹出路径选择框。取消或无可选项返回 null。
 * 即使仅一条可用路径也弹出，由用户确认。
 */
export async function pickHttpRouter(
  free: HttpRouterPickOption[],
  opts?: PickHttpRouterOptions,
): Promise<number | null> {
  if (!free.length) {
    ElMessage.warning(t('canvas.pickHttp.noPath'))
    return null
  }

  const preferred =
    opts?.preferredIndex != null &&
    free.some((o) => o.index === opts.preferredIndex)
      ? opts.preferredIndex
      : free[0].index
  const selected = ref(preferred)

  try {
    await ElMessageBox({
      title: opts?.title || t('canvas.pickHttp.title'),
      message: () =>
        h('div', { class: 'fg-http-pick' }, [
          h(
            'p',
            { style: 'margin:0 0 10px;color:#64748b;font-size:13px;' },
            opts?.hint || t('canvas.pickHttp.hint'),
          ),
          h(
            ElRadioGroup,
            {
              modelValue: selected.value,
              'onUpdate:modelValue': (
                v: string | number | boolean | undefined,
              ) => {
                selected.value = Number(v)
              },
              style:
                'display:flex;flex-direction:column;align-items:flex-start;gap:8px;',
            },
            () =>
              free.map((o) =>
                h(
                  ElRadio,
                  { value: o.index, key: o.index },
                  () => routerPickLabel(o.router),
                ),
              ),
          ),
        ]),
      confirmButtonText: t('common.ok'),
      cancelButtonText: t('common.cancel'),
      showCancelButton: true,
      closeOnClickModal: false,
      distinguishCancelAndClose: true,
    })
    return selected.value
  } catch {
    return null
  }
}
