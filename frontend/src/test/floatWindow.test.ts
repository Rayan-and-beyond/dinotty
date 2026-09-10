import { describe, it, expect } from 'vitest'
import {
  filesStatePaneId,
  floatWindowId,
  resolvePreviewOpenMode,
  type PreviewOpenMode,
} from '../types/floatWindow'

describe('resolvePreviewOpenMode', () => {
  it('falls back to the per-kind preference when no explicit mode is given', () => {
    const cases: Array<[PreviewOpenMode | undefined, PreviewOpenMode, boolean, PreviewOpenMode]> = [
      [undefined, 'split', false, 'split'],
      [undefined, 'floating', false, 'floating'],
    ]
    for (const [explicit, pref, touch, want] of cases) {
      expect(resolvePreviewOpenMode(explicit, pref, touch)).toBe(want)
    }
  })

  it('lets an explicit mode override the preference', () => {
    expect(resolvePreviewOpenMode('floating', 'split', false)).toBe('floating')
    expect(resolvePreviewOpenMode('split', 'floating', false)).toBe('split')
  })

  it('always opens as a split pane on touch devices', () => {
    expect(resolvePreviewOpenMode(undefined, 'floating', true)).toBe('split')
    expect(resolvePreviewOpenMode('floating', 'floating', true)).toBe('split')
  })
})

describe('floatWindowId', () => {
  it('uses the plugin id directly for plugin content (back-compat geometry key)', () => {
    expect(floatWindowId({ kind: 'plugin', pluginId: 'p1' })).toBe('p1')
  })

  it('keys built-in preview windows by their kind (one window per kind)', () => {
    expect(floatWindowId({ kind: 'files', sourcePaneId: 'T-1' })).toBe('float:files')
    expect(floatWindowId({ kind: 'web', initialUrl: 'https://x' })).toBe('float:web')
  })
})

describe('filesStatePaneId', () => {
  it('derives a unique per-session state pane id for the floating file browser', () => {
    expect(filesStatePaneId('T-1')).toBe('float:files:T-1')
  })
})
