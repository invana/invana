import React from 'react';
import { NodeCard } from '@invana/ui';
import type { Meta, StoryObj } from '@storybook/react';

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'Graph Components/NodeCard',
  component: NodeCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {

  },
} satisfies Meta<typeof NodeCard>;

export default meta;
type Story = StoryObj<typeof meta>;


const nodeData = {
  id: 'node-1',
  type: 'Person',
  label: "Mars",
  properties: {
    name: 'Mars',
    image: 'https://picsum.photos/480/300?grayscale.png',
    link: 'https://en.wikipedia.org/wiki/Mars',
    size: '6779 km',
    distanceFromSun: '227.9 million km',
    moons: 2,
    createdAt: '2023-10-01',
    updatedAt: '2023-10-10',
  }

}

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Default: Story = {
  args: {
    node: nodeData,
    showProperties: true,
    className: 'w-[360px]',
  },
};