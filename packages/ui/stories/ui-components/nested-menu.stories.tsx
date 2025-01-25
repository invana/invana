import type { Meta, StoryObj } from '@storybook/react';
import { File, FolderOpen, Bell, Shield, Mail, Settings, Users } from 'lucide-react'
import { MenuItem } from '@/components/ui-extended/menu-item';
import { NestedMenu } from '@/components/ui-extended/nested-menu';

export const menuItems: MenuItem[] = [
  {
    id: 'files',
    label: 'Files',
    icon: File,
    shortcut: '⌘F',
    children: [
      {
        id: 'shared',
        label: 'Shared Files',
        icon: FolderOpen,
        shortcut: '⌘S',
      },
      {
        id: 'recent',
        label: 'Recent Files',
        icon: File,
        shortcut: '⌘R',
      }
    ]
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    shortcut: '⌘,',
    children: [
      {
        id: 'account',
        label: 'Account Settings',
        icon: Users,
        children: [
          {
            id: 'profile',
            label: 'Profile',
            icon: Users,
            shortcut: '⌘P'
          },
          {
            id: 'security',
            label: 'Security',
            icon: Shield,
            shortcut: '⌘L'
          }
        ]
      },
      {
        id: 'notifications',
        label: 'Notifications',
        icon: Bell,
        shortcut: '⌘N',
      }
    ]
  },
  {
    id: 'messages',
    label: 'Messages',
    icon: Mail,
    shortcut: '⌘M',
  }
]


// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'UI Components/NestedMenu',
  component: NestedMenu,
  parameters: {
    // Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/configure/story-layout
    layout: 'centered',
  },
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ['autodocs'],
  args: {
    menuItems: menuItems
  },
} satisfies Meta<typeof NestedMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Secondary: Story = {
  args: {
    menuItems: menuItems
  },
};
