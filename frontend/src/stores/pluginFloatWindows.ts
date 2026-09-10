import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/** Open floating windows: window id -> stacking rank (higher renders in front
 *  inside the host layer). Ids are arbitrary strings — a plugin id for plugin
 *  windows ('float:files'/'float:web' for built-in previews). Geometry lives in
 *  the window component + localStorage; content validity is the host's concern. */
export const usePluginFloatWindowsStore = defineStore('pluginFloatWindows', () => {
  const windows = ref(new Map<string, number>())
  const zCounter = ref(0)

  const openIds = computed(() => Array.from(windows.value.keys()))

  function isOpen(windowId: string): boolean {
    return windows.value.has(windowId)
  }

  function focus(windowId: string): void {
    if (!windows.value.has(windowId)) return
    zCounter.value += 1
    windows.value.set(windowId, zCounter.value)
  }

  /** Open (single instance per id) or bring an existing window to front. */
  function open(windowId: string): void {
    if (!windows.value.has(windowId)) windows.value.set(windowId, 0)
    focus(windowId)
  }

  function close(windowId: string): void {
    windows.value.delete(windowId)
  }

  function toggle(windowId: string): void {
    if (windows.value.has(windowId)) close(windowId)
    else open(windowId)
  }

  /** Stacking rank for the window's z-index (0 when not open). */
  function zOf(windowId: string): number {
    return windows.value.get(windowId) ?? 0
  }

  return { windows, zCounter, openIds, isOpen, open, close, toggle, focus, zOf }
})
