import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// useEventBridge -> useSyncWebSocket -> usePluginLoader -> createKeyboardContext
// -> useHistory -> useSyncWebSocket forms a circular import; useHistory calls
// onSuggestions at module scope, so the real useSyncWebSocket is in a temporal
// dead zone by the time it is reached. Stub the module to break the cycle.
vi.mock('../composables/useSyncWebSocket', () => ({
  onEvent: () => () => {},
  getClientId: () => null,
  onSuggestions: () => () => {},
}))

vi.mock('../composables/useSettings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../composables/useSettings')>()
  return { ...actual, saveSettings: vi.fn() }
})

import PluginFloatWindow from '../components/plugin/PluginFloatWindow.vue'
import FileWorkspacePreview from '../components/preview/FileWorkspacePreview.vue'
import WebPreview from '../components/preview/WebPreview.vue'
import { usePluginFloatWindowsStore } from '../stores/pluginFloatWindows'
import { settings } from '../composables/useSettings'
import type { FloatWindowContent } from '../types/floatWindow'

// Shallow mount so the heavy preview internals (editor split, workspace boot,
// tree-watch sockets) never run; we assert the props PluginFloatWindow feeds
// them instead.
function mountContent(content: FloatWindowContent) {
  const store = usePluginFloatWindowsStore()
  const id = content.kind === 'plugin' ? content.pluginId : `float:${content.kind}`
  store.open(id)
  return mount(PluginFloatWindow, {
    props: { content, workspaceId: undefined },
    shallow: true,
  })
}

class MemoryStorage {
  private values = new Map<string, string>()
  getItem(key: string) {
    return this.values.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
  removeItem(key: string) {
    this.values.delete(key)
  }
  clear() {
    this.values.clear()
  }
}
vi.stubGlobal('localStorage', new MemoryStorage())

describe('PluginFloatWindow built-in preview content', () => {
  beforeEach(() => {
    localStorage.clear()
    window.innerWidth = 1280
    window.innerHeight = 800
    setActivePinia(createPinia())
  })

  it('renders a file browser bound to the source terminal, window-sized', () => {
    const wrapper = mountContent({ kind: 'files', sourcePaneId: 'T-1', initialPath: '/work' })

    const style = wrapper.find('.float-window').attributes('style')
    expect(style).toContain('width: 780px')
    expect(style).toContain('height: 540px')

    const preview = wrapper.findComponent(FileWorkspacePreview)
    expect(preview.exists()).toBe(true)
    expect(preview.props('visible')).toBe(true)
    expect(preview.props('paneId')).toBe('float:files:T-1')
    expect(preview.props('sourcePaneId')).toBe('T-1')
    expect(preview.props('initialPath')).toBe('/work')
    expect(preview.props('isWindow')).toBe(true)
  })

  it('renders a web preview in its own window at the given url', () => {
    const wrapper = mountContent({ kind: 'web', initialUrl: 'https://example.com' })

    const style = wrapper.find('.float-window').attributes('style')
    expect(style).toContain('width: 720px')
    expect(style).toContain('height: 520px')

    const preview = wrapper.findComponent(WebPreview)
    expect(preview.exists()).toBe(true)
    expect(preview.props('visible')).toBe(true)
    expect(preview.props('url')).toBe('https://example.com')
  })

  it('never applies the per-plugin opacity pref to a built-in preview', () => {
    settings.plugin_prefs.float_opacity = { 'float:files': 0.4 }
    const wrapper = mountContent({ kind: 'files', sourcePaneId: 'T-1' })
    const style = wrapper.find('.float-window').attributes('style')
    expect(style).toContain('opacity: 1')
    expect(style).not.toContain('0.4')
  })

  it('titles files and web windows with their preview label', () => {
    const files = mountContent({ kind: 'files', sourcePaneId: 'T-1' })
    expect(files.find('.float-title').text()).not.toBe('')

    const web = mountContent({ kind: 'web' })
    expect(web.find('.float-title').text()).not.toBe('')
  })
})
