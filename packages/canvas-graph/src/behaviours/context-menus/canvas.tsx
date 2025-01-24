import { BaseBehavior, CanvasEvent } from '@antv/g6';
import type { BaseBehaviorOptions, IPointerEvent, RuntimeContext } from '@antv/g6';
import { createRoot, Root } from 'react-dom/client';
import { MenuItem, NestedMenu } from '@invana/ui';
import { FolderOpen, Settings, Users, Shield, Bell, Mail, FileText } from 'lucide-react';
import React from 'react';


export interface CanvasContextMenuOptions extends BaseBehaviorOptions {
  className?: string;
  menuItems: MenuItem[];
}

export const menuItems: MenuItem[] = [
  {
    id: 'files',
    label: 'Incoming',
    icon: FolderOpen,
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
        icon: FileText,
        shortcut: '⌘R',
      }
    ]
  },
  {
    id: 'settings',
    label: 'OutGoing',
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
        shortcut: '⌘N'
      }
    ]
  },
  {
    id: 'messages',
    label: 'graph algorithms',
    icon: Mail,
    shortcut: '⌘M',
    children: [
      {
        id: 'shared',
        label: 'Shared Files',
        icon: FolderOpen,
        shortcut: '⌘S',
      }
    ]
  }
]

export class CanvasContextMenuBehavior extends BaseBehavior {

  container!: HTMLElement;
  root!: Root

  constructor(context: RuntimeContext, options: CanvasContextMenuOptions) {
    super(context, options);
    this.createContainer();
    this.root = createRoot(this.container);
    this.bindEvents();
  }

  public update(options: Partial<CanvasContextMenuOptions>): void {
    this.unbindEvents();
    super.update(options);
    this.bindEvents();
    // this.onToggleVisibility({} as IEvent);
  }

  createContainer() {
    this.container = document.createElement('div');
    this.container.id = 'CanvasContextMenuBehavior';
    this.container.style.position = 'absolute';
    this.container.style.zIndex = '1000';
    document.body.prepend(this.container);
  }

  onPointerMover = (event: IPointerEvent) => {
    this.hideContainer();
  }

  bindEvents() {
    const { graph } = this.context;
    graph.on(CanvasEvent.CONTEXT_MENU, this.onCanvasContextMenu.bind(this));
    graph.on(CanvasEvent.CLICK, () => this.hideContainer());
    // graph.on(CanvasEvent.POINTER_LEAVE, this.hideContainer);
  }


  unbindEvents() {
    const { graph } = this.context;
    graph.off(CanvasEvent.CONTEXT_MENU, this.onCanvasContextMenu.bind(this));
    graph.off(CanvasEvent.CLICK, () => this.hideContainer());
  }

  hideContainer = () => {
    this.container.style.display = 'none';
  }

  showContainer = (event: IPointerEvent, padding: { x: number, y: number } = { x: 0, y: 0 }) => {
    const { client } = event;
    this.container.style.left = `${client.x + padding.x}px`;
    this.container.style.top = `${client.y + padding.y}px`;
    this.container.style.display = 'block';

  }

  onCanvasContextMenu(event: IPointerEvent) {
    event.preventDefault();
    this.root.render(< NestedMenu
      className='w-[260px] bg-white rounded-md pl-0 pr-0 pt-2 pb-2 shadow-sm'
      menuItems={menuItems}
    />)
    this.showContainer(event);
  }

  destroy() {
    this.root.unmount();
    document.body.removeChild(this.container);
    this.unbindEvents();
  }

}

