/**
 * 工作区左右面板宽度：拖拽调整，并持久化到 localStorage。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

const STORAGE_KEY = 'flowgo.workspace.panelSizes'

const DEFAULT_LEFT = 200
const DEFAULT_RIGHT = 280
const MIN_LEFT = 140
const MAX_LEFT = 480
const MIN_RIGHT = 200
const MAX_RIGHT = 560

interface PanelSizes {
  left: number
  right: number
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function readStored(): PanelSizes {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { left: DEFAULT_LEFT, right: DEFAULT_RIGHT }
    const parsed = JSON.parse(raw) as Partial<PanelSizes>
    return {
      left: clamp(Number(parsed.left) || DEFAULT_LEFT, MIN_LEFT, MAX_LEFT),
      right: clamp(Number(parsed.right) || DEFAULT_RIGHT, MIN_RIGHT, MAX_RIGHT),
    }
  } catch {
    return { left: DEFAULT_LEFT, right: DEFAULT_RIGHT }
  }
}

function writeStored(sizes: PanelSizes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes))
  } catch {
    /* 私有模式等写失败时忽略 */
  }
}

/**
 * 左右侧栏宽度状态与拖拽手柄逻辑。
 */
export function usePanelLayout() {
  const initial = readStored()
  const leftWidth = ref(initial.left)
  const rightWidth = ref(initial.right)

  let dragging: 'left' | 'right' | null = null
  let startX = 0
  let startW = 0

  function persist() {
    writeStored({ left: leftWidth.value, right: rightWidth.value })
  }

  function onMove(e: MouseEvent) {
    if (!dragging) return
    const dx = e.clientX - startX
    if (dragging === 'left') {
      leftWidth.value = clamp(startW + dx, MIN_LEFT, MAX_LEFT)
    } else {
      // 右侧手柄在属性面板左侧：向右拖减小宽度，向左拖增大
      rightWidth.value = clamp(startW - dx, MIN_RIGHT, MAX_RIGHT)
    }
  }

  function onUp() {
    if (!dragging) return
    dragging = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    persist()
  }

  /** 开始拖左侧分隔条 */
  function startLeftResize(e: MouseEvent) {
    e.preventDefault()
    dragging = 'left'
    startX = e.clientX
    startW = leftWidth.value
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  /** 开始拖右侧分隔条 */
  function startRightResize(e: MouseEvent) {
    e.preventDefault()
    dragging = 'right'
    startX = e.clientX
    startW = rightWidth.value
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  onMounted(() => {
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    onUp()
  })

  return {
    leftWidth,
    rightWidth,
    startLeftResize,
    startRightResize,
  }
}
