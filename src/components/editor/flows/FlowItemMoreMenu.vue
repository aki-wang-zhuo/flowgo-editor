<script setup lang="ts">
/**
 * 流程列表项更多菜单：移动到组、创建副本、复制副本到。
 * 触发按钮用竖向三点图标（MoreFilled），比文字 ··· 更易辨认。
 */
import { useI18n } from 'vue-i18n'
import { ArrowRight, MoreFilled } from '@element-plus/icons-vue'
import type { FlowRecord } from '@/api/flow'
import type { FlowGroup } from '@/api/group'

const props = defineProps<{
  flow: FlowRecord
  groups: FlowGroup[]
}>()

const emit = defineEmits<{
  /** 移入分组；groupId 空串表示未分组 */
  move: [groupId: string]
  /** 在当前分组创建副本 */
  duplicate: []
  /** 复制副本到指定分组；groupId 空串表示未分组 */
  copyTo: [groupId: string]
}>()

const { t } = useI18n()

/** 当前流程是否已在该分组（空=未分组） */
function isCurrentGroup(groupId: string) {
  return (props.flow.groupId || '') === groupId
}
</script>

<template>
  <el-dropdown trigger="click">
    <button
      class="more"
      type="button"
      :title="t('flows.moreActions')"
      @click.stop
    >
      <el-icon :size="14"><MoreFilled /></el-icon>
    </button>
    <template #dropdown>
      <el-dropdown-menu class="more-menu">
        <el-dropdown-item @click="emit('duplicate')">
          {{ t('flows.createCopy') }}
        </el-dropdown-item>

        <!-- 复制副本到：右侧子菜单选组 -->
        <el-dropdown-item class="more-menu__nest">
          <el-dropdown
            placement="right-start"
            trigger="hover"
            teleported
            @command="(gid: string) => emit('copyTo', gid)"
          >
            <div class="more-menu__row" @click.stop.prevent>
              <span>{{ t('flows.copyToGroup') }}</span>
              <el-icon class="more-menu__arrow"><ArrowRight /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="g in groups"
                  :key="'c-' + g.id"
                  :command="g.id"
                >
                  {{ g.name }}
                </el-dropdown-item>
                <el-dropdown-item divided command="">
                  {{ t('common.ungrouped') }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </el-dropdown-item>

        <!-- 移动到组：右侧子菜单选组 -->
        <el-dropdown-item class="more-menu__nest">
          <el-dropdown
            placement="right-start"
            trigger="hover"
            teleported
            @command="(gid: string) => emit('move', gid)"
          >
            <div class="more-menu__row" @click.stop.prevent>
              <span>{{ t('flows.moveToGroup') }}</span>
              <el-icon class="more-menu__arrow"><ArrowRight /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="g in groups"
                  :key="'m-' + g.id"
                  :command="g.id"
                  :disabled="isCurrentGroup(g.id)"
                >
                  {{ g.name }}
                </el-dropdown-item>
                <el-dropdown-item
                  divided
                  command=""
                  :disabled="isCurrentGroup('')"
                >
                  {{ t('common.ungrouped') }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<style scoped>
.more {
  display: none;
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 2px;
  background: transparent;
  color: #666;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
}
.more:hover {
  color: #409eff;
  background: rgba(64, 158, 255, 0.12);
}

/* 嵌套项去掉默认内边距，由内层 row 控制 */
.more-menu__nest {
  padding: 0 !important;
}
.more-menu__nest :deep(.el-tooltip__trigger),
.more-menu__nest :deep(.el-dropdown) {
  display: block;
  width: 100%;
}
.more-menu__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  box-sizing: border-box;
  padding: 5px 16px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  cursor: pointer;
  line-height: 22px;
  outline: none;
}
.more-menu__row:hover {
  background-color: var(--el-dropdown-menuItem-hover-fill);
  color: var(--el-dropdown-menuItem-hover-color);
}
.more-menu__arrow {
  font-size: 12px;
  color: #aaa;
}
</style>

<style>
/* 父级流程行 hover 时显示更多按钮 */
.flows__item:hover .more {
  display: inline-flex;
}
</style>
