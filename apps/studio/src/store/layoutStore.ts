import { create } from 'zustand';

interface LayoutState {
  leftSidebar: string | undefined;
  rightSidebar: string | undefined;
  setLeftSidebar: (s: string | undefined) => void;
  setRightSidebar: (s: string | undefined) => void;
  closeLeftSidebar: () => void;
  closeRightSidebar: () => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  leftSidebar: undefined,
  rightSidebar: undefined,

  setLeftSidebar: (s) =>
    set(() => ({ leftSidebar: s })),

  setRightSidebar: (s) =>
    set(() => ({ rightSidebar: s })),

  closeLeftSidebar: () =>
    set(() => ({ leftSidebar: undefined })),

  closeRightSidebar: () =>
    set(() => ({ rightSidebar: undefined })),

}));