import { create } from 'zustand';
import { persist } from 'zustand/middleware';


interface ThemeState {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  initTheme: () => void;
}


export const storeName = "themeStore"


export const getInitialTheme = (storeName: string) => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const storedTheme = window.localStorage.getItem(storeName);
    if (storedTheme) {
      return storedTheme as 'light' | 'dark';
    }
  }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
};

export const useThemeStore = create(
  persist<ThemeState>(
    (set, get) => ({
      theme: getInitialTheme(storeName), // Default theme based on localStorage or system setting
      setTheme: (theme: 'light' | 'dark') => {
        set(() => ({ theme }));
        get().initTheme();
      },
      toggleTheme: () => {
        const { theme, setTheme } = get();
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
      },
      initTheme: () => {
        if (get().theme === "dark") {
          document.documentElement.classList.add('dark');
          document.documentElement.style.setProperty("color-scheme", "dark");
        } else {
          document.documentElement.classList.remove('dark');
          document.documentElement.style.removeProperty("color-scheme");
        }
      }
    }),
    {
      name: storeName, // Name of the localStorage key
      // getStorage: () => localStorage, // Specify localStorage
    }
  )
)
