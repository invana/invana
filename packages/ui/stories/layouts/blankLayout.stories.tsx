import type { Meta, StoryObj } from '@storybook/react';
import { BlankLayout } from '@invana/ui';
import type { SideBarNavitemProps } from '@invana/ui';
import {
  Activity, Compass, Database, Home,
  Network,
  Settings
} from 'lucide-react'
import React from 'react';


const sideBarTopNavitems: SideBarNavitemProps[] = [
  { name: "Home", href: "/", icon: Home },
  { name: "Explorer", href: "/explorer", icon: Compass },
  { name: "Modeller", href: "/modeller", icon: Network },
  { name: "Database Connection", href: "/connections", icon: Database },
]

const sideBarBottomNavitems: SideBarNavitemProps[] = [
  { name: "Activity", href: "/activity", icon: Activity },
  { name: "Settings", href: "#", icon: Settings },
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
    sideBarTopNavitems: sideBarTopNavitems,
    sideBarBottomNavitems: sideBarBottomNavitems,
    children: <div>Main Content here</div>,
  },
};