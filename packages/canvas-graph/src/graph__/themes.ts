export const themes = {
  'light': {
    theme: 'light',
    node: {
      style: { size: 4 },
      palette: {
        type: 'group',
        field: 'cluster',
      },
    },
    plugins: [{ type: 'background', background: '#fff' }],
  },
  'dark': {
    theme: 'dark',
    node: {
      style: { size: 4 },
      palette: {
        type: 'group',
        field: 'cluster',
      },
    },
    plugins: [{ type: 'background', background: '#000' }],
  }
}