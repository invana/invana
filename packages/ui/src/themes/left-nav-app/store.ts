import { create } from "zustand"
import { persist } from 'zustand/middleware';


interface LeftNavAppLayoutState {
  // Content states
  leftContentName: string | undefined
  rightContentName: string | undefined
  bottomContentName: string | undefined

  leftContentSize: number;
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

const defaultLeftContentSize = 25;
const defaultMainTopContentSize = 97;

export const useLeftNavAppLayoutStore = create(
  persist<LeftNavAppLayoutState>(
    (set) => ({
      leftContentName: undefined,
      rightContentName: undefined,
      bottomContentName: undefined,

      leftContentSize: 0,
      setLeftContentSize: (size) => set({ leftContentSize: size }),

      mainTopContentSize: defaultMainTopContentSize,
      setMainTopContentSize: (size) => set({ mainTopContentSize: size }),

      setLeftContentName: (name: string | undefined) => {
        return set({ leftContentName: name, leftContentSize: defaultLeftContentSize })
      },
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
    }),
    {
      name: 'layout-storage',
    }
  )
)