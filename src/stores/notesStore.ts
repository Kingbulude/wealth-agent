import { create } from 'zustand'
import { useAuthStore } from '../renderer/stores/authStore'
import {
  listNotes,
  createNote,
  updateNote,
  deleteNote
} from '../services/notesService'
import type { Note, NoteCategory, NoteInput } from '../types/note'

const STORAGE_KEY = 'wealth_agent_notes'

function getUserId(): string {
  const user = useAuthStore.getState().user
  return user?.email || user?.id || ''
}

function loadLocalNotes(): Note[] {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return all.filter((n: Note) => n.user_email === getUserId())
  } catch {
    return []
  }
}

function saveLocalNotes(notes: Note[]): void {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    const others = all.filter((n: Note) => n.user_email !== getUserId())
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...others, ...notes]))
  } catch {}
}

interface NoteState {
  notes: Note[]
  loading: boolean
  lastSyncAt: string | null

  loadNotes: (category?: NoteCategory) => Promise<void>
  createNote: (input: NoteInput) => Promise<Note>
  updateNote: (id: string, patch: Partial<NoteInput>) => Promise<void>
  deleteNote: (id: string) => Promise<void>
  togglePin: (id: string) => Promise<void>
  toggleArchive: (id: string) => Promise<void>
  getByCategory: (category: NoteCategory) => Note[]
  search: (query: string) => Note[]
}

export const useNotesStore = create<NoteState>()((set, get) => ({
  notes: [],
  loading: false,
  lastSyncAt: null,

  loadNotes: async (category?: NoteCategory) => {
    set({ loading: true })
    try {
      const data = await listNotes({ category })
      const local = loadLocalNotes()
      const userEmail = getUserId()

      // 合并本地+云端
      const merged: Note[] = [...data]
      for (const n of local) {
        if (n.user_email === userEmail && !merged.find(m => m.id === n.id)) {
          merged.push(n)
        }
      }
      saveLocalNotes(merged)
      set({ notes: merged, lastSyncAt: new Date().toISOString() })
    } catch (e) {
      console.warn('[notes] 加载云端失败，使用本地:', e)
      const local = loadLocalNotes()
      set({ notes: local })
    } finally {
      set({ loading: false })
    }
  },

  createNote: async (input: NoteInput) => {
    const userEmail = getUserId()
    const now = new Date().toISOString()
    const local: Note = {
      id: input.id || crypto.randomUUID(),
      user_email: userEmail,
      category: input.category || 'cognition',
      title: input.title || '',
      content_json: input.content_json || '{}',
      content_text: input.content_text || '',
      tags: input.tags || '',
      is_pinned: input.is_pinned ? 1 : 0,
      is_archived: input.is_archived ? 1 : 0,
      related_holding_id: input.related_holding_id || null,
      created_at: now,
      updated_at: now
    }

    // 先写本地
    const notes = [local, ...get().notes]
    saveLocalNotes(notes)
    set({ notes })

    // 同步到云端
    try {
      const remote = await createNote(input)
      const updated = notes.map(n => n.id === local.id ? { ...n, ...remote, is_pinned: remote.is_pinned, is_archived: remote.is_archived } : n)
      saveLocalNotes(updated)
      set({ notes: updated, lastSyncAt: new Date().toISOString() })
      return remote
    } catch (e) {
      console.warn('[notes] 创建云端失败，已存本地:', e)
      return local
    }
  },

  updateNote: async (id: string, patch: Partial<NoteInput>) => {
    const notes = get().notes.map(n => {
      if (n.id !== id) return n
      return {
        ...n,
        ...patch,
        is_pinned: patch.is_pinned !== undefined ? (patch.is_pinned ? 1 : 0) : n.is_pinned,
        is_archived: patch.is_archived !== undefined ? (patch.is_archived ? 1 : 0) : n.is_archived,
        updated_at: new Date().toISOString()
      }
    })
    saveLocalNotes(notes)
    set({ notes })

    try {
      await updateNote(id, patch)
      set({ lastSyncAt: new Date().toISOString() })
    } catch (e) {
      console.warn('[notes] 更新云端失败:', e)
    }
  },

  deleteNote: async (id: string) => {
    const notes = get().notes.filter(n => n.id !== id)
    saveLocalNotes(notes)
    set({ notes })

    try {
      await deleteNote(id)
      set({ lastSyncAt: new Date().toISOString() })
    } catch (e) {
      console.warn('[notes] 删除云端失败:', e)
    }
  },

  togglePin: async (id: string) => {
    const note = get().notes.find(n => n.id === id)
    if (!note) return
    const newPinned = !note.is_pinned
    await get().updateNote(id, { is_pinned: newPinned })
  },

  toggleArchive: async (id: string) => {
    const note = get().notes.find(n => n.id === id)
    if (!note) return
    const newArchived = !note.is_archived
    await get().updateNote(id, { is_archived: newArchived })
  },

  getByCategory: (category: NoteCategory) => {
    return get().notes.filter(n => n.category === category && !n.is_archived)
  },

  search: (query: string) => {
    const q = query.trim().toLowerCase()
    if (!q) return get().notes
    return get().notes.filter(n => {
      return (
        (n.title || '').toLowerCase().includes(q) ||
        (n.content_text || '').toLowerCase().includes(q) ||
        (n.tags || '').toLowerCase().includes(q)
      )
    })
  }
}))
