import { BaseBehavior, CanvasEvent, EdgeEvent } from '@antv/g6';
import type { BaseBehaviorOptions, IPointerEvent, EdgeData, RuntimeContext } from '@antv/g6';
import { createRoot, Root } from 'react-dom/client';
import { ICanvasEdge } from '@invana/data-store';
import { MenuItem, NestedMenu } from '@invana/ui';
import { FolderOpen, Settings, Users, Shield, Bell, Mail, FileText } from 'lucide-react';
import { EdgeCard } from '@invana/canvas-graph/components/edge-card';
import React from 'react';


export interface EdgeContextMenuOptions extends BaseBehaviorOptions {
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

export class EdgeContextMenuBehavior extends BaseBehavior {

  container!: HTMLElement;
  root!: Root

  constructor(context: RuntimeContext, options: EdgeContextMenuOptions) {
    super(context, options);
    this.createContainer();
    this.root = createRoot(this.container);
    this.bindEvents();
  }

  public update(options: Partial<EdgeContextMenuOptions>): void {
    this.unbindEvents();
    super.update(options);
    this.bindEvents();
    // this.onToggleVisibility({} as IEvent);
  }

  createContainer() {
    this.container = document.createElement('div');
    this.container.id = 'EdgeContextMenuBehavior';
    this.container.style.position = 'absolute';
    this.container.style.zIndex = '1000';
    document.body.prepend(this.container);
  }


  onPointerMover = (event: IPointerEvent) => {
    this.hideContainer();
  }

  bindEvents() {
    const { graph } = this.context;
    graph.on(EdgeEvent.CONTEXT_MENU, this.onEdgeContextMenu.bind(this));
    graph.on(CanvasEvent.CLICK, () => this.hideContainer());
    graph.on(EdgeEvent.POINTER_LEAVE, () => this.hideContainer());
    graph.on(EdgeEvent.POINTER_MOVE, this.onPointerMover.bind(this));
  }


  unbindEvents() {
    const { graph } = this.context;
    graph.off(EdgeEvent.CONTEXT_MENU, this.onEdgeContextMenu.bind(this));
    graph.off(CanvasEvent.CLICK, () => this.hideContainer());
    graph.off(EdgeEvent.POINTER_LEAVE, () => this.hideContainer());
    graph.off(EdgeEvent.POINTER_MOVE, this.onPointerMover.bind(this));
  }

  hideContainer = () => {
    this.container.style.display = 'none';
  }

  showContainer = (event: IPointerEvent, padding: { x: number, y: number } = { x: 0, y: 0 }) => {
    const { client } = event;
    this.container.style.left = `${client.x + padding.x}px`;
    this.container.style.top = `${client.y + padding.y}px`;
    this.container.style.display = 'block';
    const tooltipElement = document.querySelector('#EdgeTooltipBehavior') as HTMLElement;
    console.log("EdgeContextMenuBehavior -> showContainer -> tooltipElement", tooltipElement)
    if (tooltipElement) {
      tooltipElement.style.display = 'none';
    }
  }

  onEdgeContextMenu(event: IPointerEvent) {
    event.preventDefault();
    const { graph } = this.context;
    const edgeId = ((event.target as unknown) as HTMLElement).id as string;
    const edge = graph.getEdgeData(edgeId) as (EdgeData & { data?: ICanvasEdge });
    this.root.render(<EdgeCard edge={edge} extra={
      <NestedMenu
        className='rounded-none w-[260px] shadow-none p-0 border-none'
        menuItems={menuItems}
      />
    } />)
    this.showContainer(event);
  }


  // onEdgeMouseLeave(event: IPointerEvent) {
  //   // const { graph } = this.context;
  //   this.hideContainer();
  // }



  // onMouseMove(event: IPointerEvent) {
  //   this.showContainer(event);
  // }

  destroy() {
    this.root.unmount();
    document.body.removeChild(this.container);
    this.unbindEvents();
  }

}

