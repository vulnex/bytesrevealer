import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useSessionStore } from '../stores/session'
import { useAnnotations } from './useAnnotations'

function withSetup(fn) {
  let result
  const app = createApp({
    setup() {
      result = fn()
      return () => {}
    }
  })
  const pinia = createPinia()
  app.use(pinia)
  setActivePinia(pinia)
  app.mount(document.createElement('div'))
  return [result, app]
}

describe('useAnnotations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('bookmarks is empty array', () => {
      const [result, app] = withSetup(() => useAnnotations())
      expect(result.bookmarks.value).toEqual([])
      app.unmount()
    })

    it('annotations is empty array', () => {
      const [result, app] = withSetup(() => useAnnotations())
      expect(result.annotations.value).toEqual([])
      app.unmount()
    })

    it('coloredBytes is empty array', () => {
      const [result, app] = withSetup(() => useAnnotations())
      expect(result.coloredBytes.value).toEqual([])
      app.unmount()
    })

    it('notes is empty string', () => {
      const [result, app] = withSetup(() => useAnnotations())
      expect(result.notes.value).toBe('')
      app.unmount()
    })

    it('tags is empty array', () => {
      const [result, app] = withSetup(() => useAnnotations())
      expect(result.tags.value).toEqual([])
      app.unmount()
    })
  })

  describe('addBookmark', () => {
    it('adds a bookmark with correct shape', () => {
      const [result, app] = withSetup(() => useAnnotations())
      result.addBookmark(0xff)
      const bm = result.bookmarks.value[0]
      expect(bm.id).toMatch(/^bm_/)
      expect(bm.offset).toBe(0xff)
      expect(bm.label).toBe('Bookmark @ 0xFF')
      expect(bm.color).toBe('#4fc3f7')
      expect(new Date(bm.created).getTime()).not.toBeNaN()
      app.unmount()
    })

    it('creates unique ids for multiple bookmarks', () => {
      const [result, app] = withSetup(() => useAnnotations())
      result.addBookmark(0)
      result.addBookmark(1)
      expect(result.bookmarks.value[0].id).not.toBe(result.bookmarks.value[1].id)
      app.unmount()
    })
  })

  describe('updateBookmark', () => {
    it('updates an existing bookmark by id', () => {
      const [result, app] = withSetup(() => useAnnotations())
      result.addBookmark(10)
      const id = result.bookmarks.value[0].id
      result.updateBookmark({
        id,
        offset: 10,
        label: 'Updated',
        color: '#ff0000',
        created: result.bookmarks.value[0].created
      })
      expect(result.bookmarks.value[0].label).toBe('Updated')
      expect(result.bookmarks.value[0].color).toBe('#ff0000')
      app.unmount()
    })

    it('no-op when id not found', () => {
      const [result, app] = withSetup(() => useAnnotations())
      result.addBookmark(10)
      result.updateBookmark({ id: 'nonexistent', label: 'X' })
      expect(result.bookmarks.value).toHaveLength(1)
      expect(result.bookmarks.value[0].label).toMatch(/^Bookmark @/)
      app.unmount()
    })
  })

  describe('removeBookmark', () => {
    it('removes a bookmark by id', () => {
      const [result, app] = withSetup(() => useAnnotations())
      result.addBookmark(0)
      result.addBookmark(1)
      const id = result.bookmarks.value[0].id
      result.removeBookmark(id)
      expect(result.bookmarks.value).toHaveLength(1)
      expect(result.bookmarks.value[0].id).not.toBe(id)
      app.unmount()
    })
  })

  describe('addAnnotation', () => {
    it('adds an annotation with correct shape', () => {
      const [result, app] = withSetup(() => useAnnotations())
      result.addAnnotation({ startOffset: 0x10, endOffset: 0x20 })
      const an = result.annotations.value[0]
      expect(an.id).toMatch(/^an_/)
      expect(an.startOffset).toBe(0x10)
      expect(an.endOffset).toBe(0x20)
      expect(an.label).toBe('Annotation @ 0x10-0x20')
      expect(an.note).toBe('')
      expect(an.color).toBe('#81c784')
      expect(new Date(an.created).getTime()).not.toBeNaN()
      app.unmount()
    })
  })

  describe('updateAnnotation', () => {
    it('updates an existing annotation by id', () => {
      const [result, app] = withSetup(() => useAnnotations())
      result.addAnnotation({ startOffset: 0, endOffset: 5 })
      const id = result.annotations.value[0].id
      result.updateAnnotation({
        id,
        startOffset: 0,
        endOffset: 5,
        label: 'Changed',
        note: 'hello',
        color: '#000',
        created: result.annotations.value[0].created
      })
      expect(result.annotations.value[0].label).toBe('Changed')
      expect(result.annotations.value[0].note).toBe('hello')
      app.unmount()
    })

    it('no-op when id not found', () => {
      const [result, app] = withSetup(() => useAnnotations())
      result.addAnnotation({ startOffset: 0, endOffset: 5 })
      result.updateAnnotation({ id: 'nonexistent', label: 'X' })
      expect(result.annotations.value[0].label).toMatch(/^Annotation @/)
      app.unmount()
    })
  })

  describe('removeAnnotation', () => {
    it('removes an annotation by id', () => {
      const [result, app] = withSetup(() => useAnnotations())
      result.addAnnotation({ startOffset: 0, endOffset: 5 })
      const id = result.annotations.value[0].id
      result.removeAnnotation(id)
      expect(result.annotations.value).toHaveLength(0)
      app.unmount()
    })
  })

  describe('handleByteSelection', () => {
    it('adds a colored range', () => {
      const [result, app] = withSetup(() => useAnnotations())
      result.handleByteSelection({ start: 0, end: 10, color: '#ff0000' })
      expect(result.coloredBytes.value).toEqual([{ start: 0, end: 10, color: '#ff0000' }])
      app.unmount()
    })

    it('removes ranges within selection when color is #ffffff', () => {
      const [result, app] = withSetup(() => useAnnotations())
      result.handleByteSelection({ start: 0, end: 10, color: '#ff0000' })
      result.handleByteSelection({ start: 0, end: 10, color: '#ffffff' })
      expect(result.coloredBytes.value).toHaveLength(0)
      app.unmount()
    })
  })

  describe('resetAnnotations', () => {
    it('clears all annotation state', () => {
      const [result, app] = withSetup(() => useAnnotations())
      result.addBookmark(0)
      result.addAnnotation({ startOffset: 0, endOffset: 1 })
      result.handleByteSelection({ start: 0, end: 5, color: '#ff0000' })
      result.notes.value = 'test notes'
      result.tags.value = ['tag1']
      result.resetAnnotations()
      expect(result.bookmarks.value).toEqual([])
      expect(result.annotations.value).toEqual([])
      expect(result.coloredBytes.value).toEqual([])
      expect(result.notes.value).toBe('')
      expect(result.tags.value).toEqual([])
      app.unmount()
    })
  })

  describe('dirty tracking', () => {
    it('calls markDirty when bookmarks change and session is active', async () => {
      const [result, app] = withSetup(() => useAnnotations())
      const sessionStore = useSessionStore()
      sessionStore.setCurrentSession('test-id', 'Test Session')
      const spy = vi.spyOn(sessionStore, 'markDirty')

      result.addBookmark(0)
      await nextTick()
      expect(spy).toHaveBeenCalled()
      app.unmount()
    })

    it('calls markDirty when notes change and session is active', async () => {
      const [result, app] = withSetup(() => useAnnotations())
      const sessionStore = useSessionStore()
      sessionStore.setCurrentSession('test-id', 'Test Session')
      const spy = vi.spyOn(sessionStore, 'markDirty')

      result.notes.value = 'changed'
      await nextTick()
      expect(spy).toHaveBeenCalled()
      app.unmount()
    })

    it('does not call markDirty when no active session', async () => {
      const [result, app] = withSetup(() => useAnnotations())
      const sessionStore = useSessionStore()
      const spy = vi.spyOn(sessionStore, 'markDirty')

      result.addBookmark(0)
      await nextTick()
      expect(spy).not.toHaveBeenCalled()
      app.unmount()
    })
  })
})
