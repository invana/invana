import { EdgeCard, EdgeCardProps } from '@invana/ui';
import type { Meta, StoryObj } from '@storybook/react';


// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta: Meta<EdgeCardProps> = {
  title: 'Graph UI Components/EdgeCard',
  component: EdgeCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {

  },
} satisfies Meta<typeof EdgeCard>;

export default meta;
type Story = StoryObj<typeof meta>;


const edgeData = {
  id: 'edge-1',
  type: 'has_satellite',
  label: "Mars",
  source: 'mars-node',
  target: 'satellite-node',
  properties: {
    distance: '227.9 million km',
    createdAt: '2023-10-01',
    updatedAt: '2023-10-10',
  }

}

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Default: Story = {
  args: {
    edge: edgeData,
    className: "w-[380px]",
    showProperties: true,
  },
};