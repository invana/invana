import type { Meta, StoryObj } from '@storybook/react';
import { Home, Compass, Book } from 'lucide-react';
import { LeftNavAppLayout } from '@/themes/left-nav-app/default';
import { Button, LeftNavItem } from '@invana/ui';

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'Layouts/LeftNavAppLayout',
  component: LeftNavAppLayout,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
  },
} satisfies Meta<typeof LeftNavAppLayout>;

export default meta;
type Story = StoryObj<typeof meta>;



const topNavItems: LeftNavItem[] = [
  {
    icon: Compass,
    key: "dashboard",
    name: "Dashboard",
    onClick: () => {
      console.log("Clicked:", "Dashboard")
    }
  },
  {
    icon: Book,
    key: "documentation",
    name: "documentation",
    onClick: () => {
      console.log("Clicked:", "Documentation")
    }
  },
  // { icon: Users, name: "Users", },
  // { icon: Mail, name: "Messages", },
  // { icon: BarChart2, name: "Analytics", },
  // { icon: FileText, name: "Documentation", toggleSidebar: "docs" },
  // { icon: Settings, name: "Settings", },
]




// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Default: Story = {
  args: {
    headerProps: {
      left: <>
        <Home size={24} />
        <span>Dashboard</span>
      </>,
      center: < >
        <span className='font-bold mr-2'>Hello World</span>
        <span className='mr-2'>|</span>
        <span>Explorer</span>
      </>,
      right: <>
        <Button variant="ghost" >Help</Button>
      </>

    },
    leftNavProps: {
      topNavItems: topNavItems,
    },
    leftContent: <div className="space-y-2 min-w-[300px]">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="rounded border bg-card p-2 text-sm">
          Item {i + 1}
        </div>
      ))}
    </div>,
    mainTopContent: <div className="space-y-8">
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
    mainBottomContent: <></>
    ,
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