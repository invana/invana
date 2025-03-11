import type { Preview } from "@storybook/react";

const preview: Preview = {
  parameters: {
    layout: 'centered', // Centers components in the preview
    actions: { argTypesRegex: "^on[A-Z].*" }, // Automatically match action handlers
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    docs: {
      source: {
        type: 'auto', // Automatically detects the source type
      },
    }
  },
};

export default preview;
