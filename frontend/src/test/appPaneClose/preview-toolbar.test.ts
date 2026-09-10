import { describe, expect, it } from 'vitest'
import { mountWithTabs, mocks } from './_setup'
import { useSessionStore } from '../../stores/sessionStore'
import { getAllLeaves } from '../../types/pane'

// Files and web preview are visible in the toolbar by default, so each is a
// top-level button; the "More" menu only carries them once hidden in settings.
describe('App.vue - preview toolbar toggle', () => {
  it('creates a files leaf when the file browser toolbar button is clicked', async () => {
    const wrapper = await mountWithTabs()
    const session = useSessionStore()
    const filesButton = wrapper.find('button[title="previewPanel.switchFiles"]')
    const tab = session.tabs[0]
    if (tab.type !== 'terminal') throw new Error('expected terminal tab')

    expect(getAllLeaves(tab.layout).some((l) => l.kind === 'files' || l.kind === 'web')).toBe(false)

    await filesButton.trigger('click')
    expect(mocks.insertNonTerminalPane).toHaveBeenCalledWith('files', expect.anything())
  })

  it('creates a web leaf when the web preview toolbar button is clicked', async () => {
    const wrapper = await mountWithTabs()
    const session = useSessionStore()
    const tab = session.tabs[0]
    if (tab.type !== 'terminal') throw new Error('expected terminal tab')

    const existingFilesLeaf = {
      type: 'leaf' as const,
      kind: 'files' as const,
      paneId: 'existing-files-leaf',
      title: 'Files',
      ratio: 1,
      zoomed: false,
      path: '/tmp',
    }
    tab.layout = {
      type: 'split',
      id: 's-root',
      direction: 'horizontal',
      children: [tab.layout, existingFilesLeaf],
      ratios: [0.7, 0.3],
    }

    mocks.insertNonTerminalPane.mockClear()
    mocks.focusPane.mockClear()

    await wrapper.find('button[title="previewPanel.switchWeb"]').trigger('click')

    expect(mocks.insertNonTerminalPane).toHaveBeenCalledWith('web', expect.anything())
  })

  it('focuses the existing leaf of the selected kind when both files and web exist', async () => {
    const wrapper = await mountWithTabs()
    const session = useSessionStore()
    const tab = session.tabs[0]
    if (tab.type !== 'terminal') throw new Error('expected terminal tab')

    const filesLeaf = {
      type: 'leaf' as const,
      kind: 'files' as const,
      paneId: 'files-leaf-1',
      title: 'Files',
      ratio: 1,
      zoomed: false,
      path: '/tmp',
    }
    const webLeaf = {
      type: 'leaf' as const,
      kind: 'web' as const,
      paneId: 'web-leaf-1',
      title: 'Web',
      ratio: 1,
      zoomed: false,
      url: 'https://example.com',
    }
    tab.layout = {
      type: 'split',
      id: 's-root',
      direction: 'horizontal',
      children: [tab.layout, filesLeaf, webLeaf],
      ratios: [0.4, 0.3, 0.3],
    }

    mocks.insertNonTerminalPane.mockClear()
    mocks.focusPane.mockClear()

    await wrapper.find('button[title="previewPanel.switchWeb"]').trigger('click')

    expect(mocks.focusPane).toHaveBeenCalledWith('web-leaf-1')
    expect(mocks.insertNonTerminalPane).not.toHaveBeenCalled()
  })
})
