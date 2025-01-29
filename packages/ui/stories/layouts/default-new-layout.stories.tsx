import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@invana/ui';
import type { Meta, StoryObj } from '@storybook/react';
import { usePanel } from '@/themes/default/context/panel-context';
import { cn } from '@/lib/utils';
import React from 'react';
import { NavItem } from '@/themes/default-new/types';
import { Home, Users, Mail, BarChart2, FileText, Settings } from 'lucide-react';
import { DefaultNewLayout } from '@/themes/default-new/default-new';
// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'Layouts/DefaultNewLayout',
  component: DefaultNewLayout,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
  },
} satisfies Meta<typeof DefaultNewLayout>;

export default meta;
type Story = StoryObj<typeof meta>;



const navItems: NavItem[] = [
  { icon: Home, label: "Dashboard", href: "#", toggleSidebar: "query" },
  { icon: Users, label: "Users", href: "#" },
  { icon: Mail, label: "Messages", href: "#" },
  { icon: BarChart2, label: "Analytics", href: "#" },
  { icon: FileText, label: "Documentation", href: "#", toggleSidebar: "docs" },
  { icon: Settings, label: "Settings", href: "#" },
]

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Default: Story = {
  args: {
    className: "h-screen w-full",
    leftNavProps: {
      items: navItems,
      activeItem: "Dashboard",
      onItemClick: (item) => {
        console.log("Clicked:", item.label)
      },
    },
    leftContent: <div className="space-y-2 min-w-[300px]">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="rounded border bg-card p-2 text-sm">
          Item {i + 1}
        </div>
      ))}
    </div>,
    mainContent: <div className="space-y-8">
      <div className="prose dark:prose-invert">
        <h3>Welcome to the Dashboard</h3>
        <p>
          This is a resizable panel layout. You can drag the handles between panels to resize them. The layout is
          persistent and will maintain its state across reloads.
        </p>
        <p>Try dragging the handles between panels to resize them:</p>
        <ul>
          <li>Click the home icon to toggle the navigation tree</li>
          <li>Click the documentation icon to toggle the right sidebar</li>
          <li>The navigation tree panel has a minimum width of 300px and is resizable</li>
          <li>Click the chevron button to collapse/expand the bottom panel</li>
          <li>Drag the vertical handle to resize the content sections</li>
        </ul>
      </div>

    </div>,
    rightContent: <div className="prose prose-sm dark:prose-invert">
      <h3>Getting Started</h3>
      <p>Welcome to the documentation. This panel provides helpful information about using the dashboard.</p>
      <h4>Key Features</h4>
      <ul>
        <li>Resizable panels</li>
        <li>Collapsible sections</li>
        <li>Responsive design</li>
        <li>Dark mode support</li>
      </ul>
      <h4>Navigation</h4>
      <p>
        Use the left sidebar to navigate between different sections. Click on the icons to access different
        features.
      </p>
      <h4>Customization</h4>
      <p>You can customize the layout by:</p>
      <ul>
        <li>Resizing panels using the drag handles</li>
        <li>Collapsing/expanding sections</li>
        <li>Toggling sidebars</li>
      </ul>
    </div>




  },
};