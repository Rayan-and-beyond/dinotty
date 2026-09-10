import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

vi.mock('../composables/useSyncWebSocket', () => ({
  onEvent: () => () => {},
  getClientId: () => null,
  onSuggestions: () => () => {},
}))

vi.mock('../composables/useSettings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../composables/useSettings')>()
  return { ...actual, saveSettings: vi.fn() }
})

import PluginFloatWindowHost from '../components/plugin/PluginFloatWindowHost.vue'
import PluginFloatWindow from '../components/plugin/PluginFloatWindow.vue'
import { loadedPlugins } from '../composables/usePluginLoader'
import { usePluginFloatWindowsStore } from '../stores/pluginFloatWindows'
import type { FloatWindowContent } from '../types/floatWindow'

const fakeApi = { open: () => {} }
const filesContent: FloatWindowContent = { kind: 'files', sourcePaneId: 'T-1', initialPath: '/work' }

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

describe('PluginFloatWindowHost built-in preview content', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    loadedPlugins.clear()
  })

  it('renders a window for an open id resolved by getPreviewContent (no plugin)', () => {
    const store = usePluginFloatWindowsStore()
    store.open('float:files')
    const wrapper = mount(PluginFloatWindowHost, {
      props: {
        getPluginContext: (() => fakeApi) as never,
        getPreviewContent: (id: string) => (id === 'float:files' ? filesContent : undefined),
        workspaceId: undefined,
      },
      shallow: true,
    })
    const win = wrapper.findComponent(PluginFloatWindow)
    expect(win.exists()).toBe(true)
    expect(win.props('content')).toEqual(filesContent)
    expect(win.props('plugin')).toBeUndefined()
    expect(win.props('api')).toBeUndefined()
  })

  it('prefers a loaded active plugin over the preview fallback for the same id', () => {
    // p1 also "exists" as preview content, but the plugin wins.
    const store = usePluginFloatWindowsStore()
    const plugin = {
      id: 'p1',
      manifest: { id: 'p1', name: 'p1', version: '1.0.0' },
      module: { activate: () => ({}) },
      exports: null,
      state: 'active',
    } as never
    loadedPlugins.set('p1', plugin)
    store.open('p1')
    const wrapper = mount(PluginFloatWindowHost, {
      props: {
        getPluginContext: (() => fakeApi) as never,
        getPreviewContent: (id: string) => (id === 'p1' ? filesContent : undefined),
        workspaceId: undefined,
      },
      shallow: true,
    })
    const win = wrapper.findComponent(PluginFloatWindow)
    expect(win.exists()).toBe(true)
    expect(win.props('plugin')).toEqual(plugin)
    expect(win.props('content')).toBeUndefined()
  })

  it('closes the store entry when a preview window loses its content', async () => {
    const store = usePluginFloatWindowsStore()
    store.open('float:files')
    const wrapper = mount(PluginFloatWindowHost, {
      props: {
        getPluginContext: (() => fakeApi) as never,
        getPreviewContent: (id: string) => (id === 'float:files' ? filesContent : undefined),
        workspaceId: undefined,
      },
      shallow: true,
    })
    expect(wrapper.find('.float-window-layer').exists()).toBe(true)
    expect(store.isOpen('float:files')).toBe(true)

    wrapper.setProps({ getPreviewContent: () => undefined })
    await nextTick()
    await nextTick()
    expect(wrapper.find('.float-window-layer').exists()).toBe(false)
    expect(store.isOpen('float:files')).toBe(false)
  })
})
