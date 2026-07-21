import { create } from 'zustand'
import { useAuthStore } from '../renderer/stores/authStore'
import {
  listNotes,
  createNote,
  updateNote,
  deleteNote
} from '../services/notesService'
import type { Note, NoteCategory, NoteInput } from '../types/note'

function getUserId(): string {
  const user = useAuthStore.getState().user
  return user?.email || user?.id || ''
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
      set({ notes: data, lastSyncAt: new Date().toISOString() })
    } catch (e) {
      console.warn('[notes] 加载云端失败:', e)
      set({ notes: [] })
    } finally {
      set({ loading: false })
    }
  },

  createNote: async (input: NoteInput) => {
    const userEmail = getUserId()
    const remote = await createNote(input)
    const note: Note = {
      ...remote,
      user_email: userEmail,
      is_pinned: remote.is_pinned ? 1 : 0,
      is_archived: remote.is_archived ? 1 : 0
    }
    set(state => ({
      notes: [note, ...state.notes],
      lastSyncAt: new Date().toISOString()
    }))
    return note
  },

  updateNote: async (id: string, patch: Partial<NoteInput>) => {
    await updateNote(id, patch)
    set(state => ({
      notes: state.notes.map(n => {
        if (n.id !== id) return n
        return {
          ...n,
          ...patch,
          is_pinned: patch.is_pinned !== undefined ? (patch.is_pinned ? 1 : 0) : n.is_pinned,
          is_archived: patch.is_archived !== undefined ? (patch.is_archived ? 1 : 0) : n.is_archived,
          updated_at: new Date().toISOString()
        }
      }),
      lastSyncAt: new Date().toISOString()
    }))
  },

  deleteNote: async (id: string) => {
    await deleteNote(id)
    set(state => ({
      notes: state.notes.filter(n => n.id !== id),
      lastSyncAt: new Date().toISOString()
    }))
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