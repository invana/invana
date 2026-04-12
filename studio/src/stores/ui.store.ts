import { create } from "zustand";

interface UIState {
	activeNavItem: string;
	setActiveNavItem: (item: string) => void;
	sidebarCollapsed: boolean;
	setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
	activeNavItem: "graphs",
	setActiveNavItem: (activeNavItem) => set({ activeNavItem }),
	sidebarCollapsed: false,
	setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
}));
