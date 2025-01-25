import { TreeItem, TreeView } from '@invana/ui';
import type { Meta, StoryObj } from '@storybook/react';
import { File, Folder } from 'lucide-react'
import React from 'react';


const exampleData: TreeItem[] = [
  {
    id: 0,
    label: "Root",
    // style: { width: "200px" },
    isExpanded: true,

    icon: <Folder className="h-4 w-4 shrink-0 text-yellow-500" />,
    children: [
      {
        id: "1",
        label: "Root 1",
        icon: <Folder className="h-4 w-4 shrink-0 text-yellow-500" />,
        isExpanded: true,
        children: [
          {
            id: "1-1",
            label: "Child 1-1",
            icon: <Folder className="h-4 w-4 shrink-0 text-yellow-500" />,
            children: [
              {
                id: "1-1-1",
                icon: <File className="h-4 w-4 shrink-0 text-gray-500" />,
                label: "Clickable Grandchild 1-1-1",
                onClick: (id, label) => alert(`Clicked id:${id}; label:${label}`)
              },
              { id: "1-1-2", icon: <File className="h-4 w-4 shrink-0 text-gray-500" />, label: "Grandchild 1-1-2" }
            ]
          },
          { id: "1-2", icon: <File className="h-4 w-4 shrink-0 text-gray-500" />, label: "Child 1-2" }
        ]
      },
      {
        id: "2",
        label: "Root 2",
        icon: <Folder className="h-4 w-4 shrink-0 text-yellow-500" />,
        children: [
          { id: "2-1", icon: <File className="h-4 w-4 shrink-0 text-gray-500" />, label: "Child 2-1" },
          { id: "2-2", icon: <File className="h-4 w-4 shrink-0 text-gray-500" />, label: "Child 2-2" }
        ]
      }
    ]
  }

]

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'UI Components/TreeView',
  component: TreeView,
  parameters: {
    // Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/configure/story-layout
    layout: 'centered',
  },
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ['autodocs'],
  args: {
    items: exampleData,
    className: "w-[320px]",
    style: { width: "320px" }
  },
} satisfies Meta<typeof TreeView>;

export default meta;
type Story = StoryObj<typeof meta>;

// // More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Searchable: Story = {
  args: {
    items: exampleData,
    searchable: true
  },
};



// // More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Header: Story = {
  args: {
    items: exampleData,
    searchable: true,
    header: <div className=' mb-2 border-b pb-2'>
      <h1 className='text-xl font-bold'>Header</h1>
      <p className='text-sm'>Here comes the descriiption for this header.</p>
    </div>
  },
};
