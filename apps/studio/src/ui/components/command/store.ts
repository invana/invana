import { create } from "zustand"
import { persist } from "zustand/middleware"

export type CommandItem = {
  id: string
  label: string
  icon: string // We'll store icon name as string
  shortcut?: string[]
  action: () => void
}

interface CommandStore {
  pinnedItems: string[] // Store IDs of pinned items
  recentItems: string[] // Store IDs of recent items
  togglePin: (id: string) => void
  addRecent: (id: string) => void
  removeRecent: (id: string) => void
}

export const useCommandStore = create<CommandStore>()(
  persist(
    (set) => ({
      pinnedItems: [],
      recentItems: [],
      togglePin: (id) =>
        set((state) => ({
          pinnedItems: state.pinnedItems.includes(id)
            ? state.pinnedItems.filter((item) => item !== id)
            : [...state.pinnedItems, id],
        })),
      addRecent: (id) =>
        set((state) => ({
          recentItems: [id, ...state.recentItems.filter((item) => item !== id)].slice(0, 5), // Keep only last 5 recent items
        })),
      removeRecent: (id) =>
        set((state) => ({
          recentItems: state.recentItems.filter((item) => item !== id),
        })),
    }),
    {
      name: "command-store",
    },
  ),
)

