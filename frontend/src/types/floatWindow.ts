/** What can live inside a floating window: a plugin, or a built-in preview
 *  pane (files/web). 'plugin' is reserved for future plugin-kind entries; the
 *  chrome is driven by the plugin/api props path today. */
export type FloatablePaneKind = 'plugin' | 'files' | 'web'

export type FloatWindowContent =
  | { kind: 'plugin'; pluginId: string }
  | { kind: 'files'; sourcePaneId: string; initialPath?: string }
  | { kind: 'web'; initialUrl?: string }

export function floatWindowId(c: FloatWindowContent): string {
  return c.kind === 'plugin' ? c.pluginId : `float:${c.kind}`
}

export function filesStatePaneId(sourcePaneId: string): string {
  return `float:files:${sourcePaneId}`
}

export type PreviewOpenMode = 'split' | 'floating'

export function resolvePreviewOpenMode(
  explicit: PreviewOpenMode | undefined,
  pref: PreviewOpenMode,
  touch: boolean
): PreviewOpenMode {
  if (touch) return 'split'
  return explicit ?? pref
}
