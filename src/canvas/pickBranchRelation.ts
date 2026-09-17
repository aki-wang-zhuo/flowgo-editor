/**
 * 弹出分支出边 relation 选择（IF：True/False；SWITCH：cases + Default）。
 */
import { h, ref } from 'vue'
import { ElMessage, ElMessageBox, ElRadio, ElRadioGroup } from 'element-plus'
import { t } from '@/i18n'

export interface BranchRelationOption {
  relation: string
  label: string
}

/**
 * @returns 选中的 relation；取消或无可选项返回 null
 */
export async function pickBranchRelation(
  options: BranchRelationOption[],
  opts?: { title?: string; hint?: string; preferred?: string },
): Promise<string | null> {
  if (!options.length) {
    ElMessage.warning(t('canvas.pickBranch.noOutlet'))
    return null
  }

  const preferred =
    opts?.preferred && options.some((o) => o.relation === opts.preferred)
      ? opts.preferred
      : options[0].relation
  const selected = ref(preferred)

  try {
    await ElMessageBox({
      title: opts?.title || t('canvas.pickBranch.title'),
      message: () =>
        h('div', { class: 'fg-branch-pick' }, [
          h(
            'p',
            { style: 'margin:0 0 10px;color:#64748b;font-size:13px;' },
            opts?.hint || t('canvas.pickBranch.hint'),
          ),
          h(
            ElRadioGroup,
            {
              modelValue: selected.value,
              'onUpdate:modelValue': (
                v: string | number | boolean | undefined,
              ) => {
                selected.value = String(v)
              },
              style:
                'display:flex;flex-direction:column;align-items:flex-start;gap:8px;',
            },
            () =>
              options.map((o) =>
                h(ElRadio, { value: o.relation, key: o.relation }, () => o.label),
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
