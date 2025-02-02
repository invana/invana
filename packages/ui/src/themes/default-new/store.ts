import { create } from "zustand"


interface PanelState {
  // Content states
  leftContentName: string | undefined
  rightContentName: string | undefined
  bottomContentName: string | undefined

  leftContentSize: number | undefined
  setLeftContentSize: (name: number) => void

  mainTopContentSize: number
  setMainTopContentSize: (name: number) => void

  // Functions
  setLeftContentName: (name: string | undefined) => void
  setRightContentName: (name: string | undefined) => void
  setBottomContentName: (name: string | undefined) => void

  toggleLeftContent: (name: Exclude<string | undefined, undefined>) => void
  toggleRightContent: (name: Exclude<string | undefined, undefined>) => void
  toggleBottomContent: (name: Exclude<string | undefined, undefined>) => void
}

export const usePanelStore = create<PanelState>((set) => ({
  leftContentName: undefined,
  rightContentName: undefined,
  bottomContentName: undefined,


  leftContentSize: undefined,
  setLeftContentSize: (size) => set({ leftContentSize: size }),

  mainTopContentSize: 97,
  setMainTopContentSize: (size) => set({ mainTopContentSize: size }),

  setLeftContentName: (name) => set({ leftContentName: name }),
  setRightContentName: (name) => set({ rightContentName: name }),
  setBottomContentName: (name) => set({ bottomContentName: name }),

  toggleLeftContent: (name) => set((state) => ({
    leftContentName: state.leftContentName === name ? undefined : name
  })),
  toggleRightContent: (name) => set((state) => ({
    rightContentName: state.rightContentName === name ? undefined : name
  })),
  toggleBottomContent: (name) => set((state) => ({
    bottomContentName: state.bottomContentName === name ? undefined : name
  }))
}))