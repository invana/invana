import sharedConfig from '../../packages/config-tailwind/tailwind.config';

/** @type {import('tailwindcss').Config} */
export const presets = [sharedConfig];
export const content = [
  "./src/**/*.{ts,tsx}",
  "../../packages/ui/src/**/*.{ts,tsx}",
  "../../packages/canvas-reactflow/src/**/*.{ts,tsx}",
  "../../packages/canvas-graph/src/**/*.{ts,tsx}"

];
