/**
 * `@invana-studio/shell` — what every product shares: `<StudioShell>` (the one
 * `AppLayoutV2` composition, with its header and `leftNav`), the product
 * registry and action registry, sign-in, profile settings, the error page
 * and the theme bridges. It never imports a product; the app hands it the list.
 */

export * from "./actions";
export * from "./components/AppVersion";
export * from "./components/ConfirmDialog";
export * from "./components/ProtectedRoute";
export * from "./components/SaturationBridge";
export * from "./components/ThemeSyncBridge";
export * from "./pages/auth/LoginPage";
export * from "./pages/ErrorPage";
export * from "./pages/settings/ProfileSettingsPage";
export * from "./products";
export * from "./StudioShell";
