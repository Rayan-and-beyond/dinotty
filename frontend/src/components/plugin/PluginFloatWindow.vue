<template>
  <div
    ref="winEl"
    class="float-window"
    :class="{ 'is-dragging': dragging, 'is-resizing': resizing }"
    :style="winStyle"
    @pointerdown.capture="onWindowPointerDown"
    @mouseenter="hovering = true"
    @mouseleave="hovering = false"
  >
    <div
      class="float-titlebar"
      @pointerdown="drag.onPointerDown"
      @click.capture="drag.onSurfaceClick"
    >
      <span class="float-title" :title="winTitle">{{ winTitle }}</span>
      <button
        class="float-close"
        :title="t('plugin.floatWindow.close')"
        :aria-label="t('plugin.floatWindow.close')"
        @pointerdown.stop
        @click="store.close(winId)"
      >
        <X :size="14" />
      </button>
    </div>
    <div class="float-body" :class="content ? 'float-body--preview' : ''">
      <template v-if="pluginView && (!content || content.kind === 'plugin')">
        <PluginView
          :plugin="pluginView.plugin"
          :api="pluginView.api"
          :pane-id="floatPaneId(winId)"
          :workspace-id="workspaceId"
          :is-visible="true"
          :is-focused="true"
          :show-overlays="false"
        />
      </template>
      <template v-else-if="filesContent">
        <FileWorkspacePreview
          :visible="true"
          :pane-id="filesStatePaneId(filesContent.sourcePaneId)"
          :source-pane-id="filesContent.sourcePaneId"
          :initial-path="filesContent.initialPath"
          :is-window="true"
        />
      </template>
      <template v-else-if="webContent">
        <WebPreview :visible="true" :url="webContent.initialUrl ?? ''" />
      </template>
    </div>
    <div class="float-resize-handle" @pointerdown="resize.onHandlePointerDown" />
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref } from 'vue'
import { X } from 'lucide-vue-next'
import { useFloatingDrag } from '../../composables/useFloatingDrag'
import { FOCUS_ACTIVE_KEY } from '../../composables/useFocusActive'
import { subscribe } from '../../composables/useEventBridge'
import { useI18n } from '../../composables/useI18n'
import { useWindowResize } from '../../composables/useWindowResize'
import { usePluginFloatWindowsStore } from '../../stores/pluginFloatWindows'
import { floatPaneId } from '../../utils/pluginPaneId'
import { settings } from '../../composables/useSettings'
import type { LoadedPlugin, PluginContext } from '../../composables/usePluginLoader'
import type { FloatablePaneKind, FloatWindowContent } from '../../types/floatWindow'
import { filesStatePaneId, floatWindowId } from '../../types/floatWindow'
import PluginView from './PluginView.vue'
import FileWorkspacePreview from '../preview/FileWorkspacePreview.vue'
import WebPreview from '../preview/WebPreview.vue'

const props = defineProps<{
  /** Plugin window path: content is undefined and plugin/api drive the body. */
  plugin?: LoadedPlugin
  api?: PluginContext
  /** Built-in preview window path: content decides body + geometry. */
  content?: FloatWindowContent
  workspaceId?: string
}>()

const { t } = useI18n()
const store = usePluginFloatWindowsStore()
const focusActive = inject(FOCUS_ACTIVE_KEY, undefined)

/** Hovered -> fully opaque so the controls stay usable at a low configured opacity. */
const hovering = ref(false)

const kind = computed<FloatablePaneKind>(() => props.content?.kind ?? 'plugin')
/** Plugin windows keep id === plugin.id (back-compat for persisted geometry). */
const winId = computed(() =>
  props.content ? floatWindowId(props.content) : (props.plugin?.id ?? '')
)
const winTitle = computed(() => {
  if (!props.content) return props.plugin?.manifest.name ?? ''
  if (props.content.kind === 'files') return t('previewPanel.switchFiles')
  if (props.content.kind === 'web') return t('previewPanel.switchWeb')
  return props.plugin?.manifest.name ?? props.content.pluginId
})
const pluginView = computed(() =>
  props.plugin && props.api ? { plugin: props.plugin, api: props.api } : null
)
const filesContent = computed(() =>
  props.content?.kind === 'files' ? props.content : null
)
const webContent = computed(() =>
  props.content?.kind === 'web' ? props.content : null
)

const FLOAT_OPACITY_MIN = 0.3
function configuredOpacity(): number {
  // float_opacity is plugin-id-keyed; previews always render fully opaque.
  if (kind.value !== 'plugin') return 1
  const raw = settings.plugin_prefs?.float_opacity?.[winId.value]
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 1
  return Math.min(1, Math.max(FLOAT_OPACITY_MIN, raw))
}

const winEl = ref<HTMLElement | null>(null)

const DEFAULT_SIZE: Record<FloatablePaneKind, { w: number; h: number }> = {
  plugin: { w: 480, h: 360 },
  files: { w: 780, h: 540 },
  web: { w: 720, h: 520 },
}
function defaultSize(): { w: number; h: number } {
  return DEFAULT_SIZE[kind.value]
}

interface WindowGeom {
  x: number
  y: number
  w: number
  h: number
}

const storageKey = computed(() => `dinotty:floating-win:${winId.value}`)

function readGeom(): Partial<WindowGeom> | null {
  try {
    const raw = localStorage.getItem(storageKey.value)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const out: Partial<WindowGeom> = {}
    if (typeof parsed?.x === 'number') out.x = parsed.x
    if (typeof parsed?.y === 'number') out.y = parsed.y
    if (typeof parsed?.w === 'number') out.w = parsed.w
    if (typeof parsed?.h === 'number') out.h = parsed.h
    return out
  } catch {
    return null
  }
}

function persistGeom(partial: Partial<WindowGeom>): void {
  try {
    const merged: WindowGeom = {
      x: drag.x.value,
      y: drag.y.value,
      w: size.value.w,
      h: size.value.h,
      ...partial,
    }
    localStorage.setItem(storageKey.value, JSON.stringify(merged))
  } catch {
    // storage unavailable (private mode): geometry just won't persist
  }
}

const saved = readGeom()
const size = ref({ w: saved?.w ?? defaultSize().w, h: saved?.h ?? defaultSize().h })

function isTextEditable(el: HTMLElement): boolean {
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true
  return el.isContentEditable
}

/** Give focus back to the active terminal after a title-bar drag, unless the
 *  focused element is a text editor inside the window (OverlayDragItem pattern). */
function restoreFocus() {
  const active = document.activeElement as HTMLElement | null
  if (!active || !winEl.value?.contains(active)) return
  if (isTextEditable(active)) return
  active.blur()
  focusActive?.()
}

const drag = useFloatingDrag({
  element: winEl,
  initialPosition: () =>
    saved?.x !== undefined && saved?.y !== undefined
      ? { x: saved.x, y: saved.y }
      : {
          x: (window.innerWidth - (saved?.w ?? defaultSize().w)) / 2,
          y: (window.innerHeight - (saved?.h ?? defaultSize().h)) / 2,
        },
  persist: (x, y) => persistGeom({ x, y }),
  onDragEnd: () => restoreFocus(),
})

const resize = useWindowResize({
  size,
  x: drag.x,
  y: drag.y,
  persist: (w, h) => persistGeom({ w, h }),
})

const dragging = drag.dragging
const resizing = resize.resizing

const winStyle = computed(() => ({
  ...drag.style.value,
  width: `${size.value.w}px`,
  height: `${size.value.h}px`,
  zIndex: store.zOf(winId.value),
  opacity: hovering.value ? 1 : configuredOpacity(),
}))

function onWindowPointerDown() {
  store.focus(winId.value)
}

const kbUnsubs = [
  subscribe('kb-open', () => {
    drag.reClamp()
    resize.clampSize()
  }),
  subscribe('kb-close', () => {
    drag.reClamp()
    resize.clampSize()
  }),
]

onBeforeUnmount(() => {
  kbUnsubs.forEach((u) => u())
})
</script>

<style scoped>
.float-window {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  background: var(--bg-main);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--dialog-shadow);
  overflow: hidden;
  transition: opacity 0.15s ease;
}
.float-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex: none;
  height: 30px;
  padding: 0 0.35rem 0 0.75rem;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  cursor: grab;
  user-select: none;
  touch-action: none;
}
.float-window.is-dragging .float-titlebar {
  cursor: grabbing;
}
.float-title {
  font-size: 12px;
  color: var(--fg-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.float-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  color: var(--fg-muted);
  background: transparent;
  border: none;
  border-radius: var(--radius);
  cursor: pointer;
}
.float-close:hover {
  color: var(--text-color);
  background: var(--bg-hover);
}
.float-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.float-body--preview {
  display: flex;
}
.float-body--preview > * {
  flex: 1;
  min-width: 0;
  min-height: 0;
}
.float-resize-handle {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 14px;
  height: 14px;
  cursor: nwse-resize;
  touch-action: none;
}
</style>
