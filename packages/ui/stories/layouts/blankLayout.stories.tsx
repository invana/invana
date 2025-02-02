import type { Meta, StoryObj } from '@storybook/react';
import { BlankLayout } from '@invana/ui';
import type { LeftNavItem } from '@invana/ui';
import {
  Activity, Compass, Database, Home,
  Network,
  Settings
} from 'lucide-react'


const topNavItems: LeftNavItem[] = [
  { name: "Home", key: "home", href: "/", icon: Home },
  { name: "Explorer", key: "explorer", href: "/explorer", icon: Compass },
  { name: "Modeller", key: "modeller", href: "/modeller", icon: Network },
  { name: "Database Connection", key: "connections", href: "/connections", icon: Database },
]

const bottomNavItems: LeftNavItem[] = [
  { name: "Activity", key: "activity", href: "/activity", icon: Activity },
  { name: "Settings", key: "settings", href: "#", icon: Settings },
]

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'Layouts/BlankLayout',
  component: BlankLayout,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {

  },
} satisfies Meta<typeof BlankLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Default: Story = {
  args: {
    logo: <Compass className='h-4 w-4' />,
    topNavItems: topNavItems,
    bottomNavItems: bottomNavItems,
    children: <div>Main Content here</div>,
  },
};