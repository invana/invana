import { create } from "zustand"

type SidebarType = "query" | "docs" | undefined

interface PanelState {
  leftNavSize: number
  bottomNavSize: number | undefined
  isLeftSidebarVisible: boolean
  isRightSidebarVisible: boolean
  isBottomPanelCollapsed: boolean
  sidebar: SidebarType
  activeFooterItem: string | undefined
  setLeftNavSize: (size: number) => void
  setBottomNavSize: (size: number | undefined) => void
  toggleLeftSidebar: () => void
  toggleRightSidebar: () => void
  toggleBottomPanel: () => void
  setSidebar: (type: SidebarType) => void
  setActiveFooterItem: (item: string | undefined) => void
  expandBottomPanel: () => void
  defaultBottomSize: number
  defaultBottomExpandedSize: number
}

const defaultBottomSize = 3
const defaultBottomExpandedSize = 30

export const usePanelStore = create<PanelState>((set) => ({
  leftNavSize: 0,
  bottomNavSize: defaultBottomSize,
  isLeftSidebarVisible: false,
  isRightSidebarVisible: false,
  isBottomPanelCollapsed: true,
  sidebar: undefined,
  activeFooterItem: undefined,
  defaultBottomSize,
  defaultBottomExpandedSize,
  setLeftNavSize: (size) => set({ leftNavSize: size }),
  setBottomNavSize: (size) =>
    set((state) => ({
      bottomNavSize: size,
      isBottomPanelCollapsed: size === undefined,
    })),
  toggleLeftSidebar: () =>
    set((state) => ({
      isLeftSidebarVisible: !state.isLeftSidebarVisible,
    })),
  toggleRightSidebar: () =>
    set((state) => ({
      isRightSidebarVisible: !state.isRightSidebarVisible,
    })),
  toggleBottomPanel: () =>
    set((state) => ({
      bottomNavSize: state.bottomNavSize === defaultBottomSize ? defaultBottomExpandedSize : defaultBottomSize,
      isBottomPanelCollapsed: !state.isBottomPanelCollapsed,
    })),
  setSidebar: (type) => set({ sidebar: type }),
  setActiveFooterItem: (item) => set({ activeFooterItem: item }),
  expandBottomPanel: () =>
    set((state) => ({
      bottomNavSize: defaultBottomExpandedSize,
      isBottomPanelCollapsed: false,
    })),
}))

