import { create } from 'zustand';

interface LayoutState {
  leftSidebar: string | undefined;
  rightSidebar: string | undefined;
  setLeftSidebar: (s: string) => void;
  setRightSidebar: (s: string) => void;
  closeLeftSidebar: () => void;
  closeRightSidebar: () => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  leftSidebar: undefined,
  rightSidebar: undefined,

  setLeftSidebar: (s: string) =>
    set(() => ({ leftSidebar: s })),

  setRightSidebar: (s: string) =>
    set(() => ({ rightSidebar: s })),

  closeLeftSidebar: () =>
    set(() => ({ leftSidebar: undefined })),

  closeRightSidebar: () =>
    set(() => ({ rightSidebar: undefined })),

}));