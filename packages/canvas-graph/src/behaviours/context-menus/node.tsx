import { BaseBehavior, CanvasEvent, NodeEvent } from '@antv/g6';
import type { BaseBehaviorOptions, IPointerEvent, NodeData, RuntimeContext } from '@antv/g6';
import { createRoot, Root } from 'react-dom/client';
import { ICanvasNode, IProperties } from '@invana/data-store';
import { ButtonWithTooltip, MenuItem, NestedMenu, Separator } from '@invana/ui';
import { FolderOpen, Settings, Bell, Mail, FileText, CircleDot, Terminal, Lock, Monitor, Tag } from 'lucide-react';
import { NodeCard } from '@invana/ui';
import React from 'react';


export interface NodeContextMenuOptions extends BaseBehaviorOptions {
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

export class NodeContextMenuBehavior extends BaseBehavior {

  container!: HTMLElement;
  root!: Root

  constructor(context: RuntimeContext, options: NodeContextMenuOptions) {
    super(context, options);
    this.createContainer();
    this.root = createRoot(this.container);
    this.bindEvents();
  }

  public update(options: Partial<NodeContextMenuOptions>): void {
    this.unbindEvents();
    super.update(options);
    this.bindEvents();
    // this.onToggleVisibility({} as IEvent);
  }

  createContainer() {
    this.container = document.createElement('div');
    this.container.id = 'NodeContextMenuBehavior';
    this.container.style.position = 'absolute';
    this.container.style.zIndex = '10';
    document.body.append(this.container);
  }


  onPointerMover = (_: IPointerEvent) => {
    this.hideContainer();
  }

  bindEvents() {
    const { graph } = this.context;
    graph.on(NodeEvent.CONTEXT_MENU, this.onNodeContextMenu.bind(this));
    graph.on(CanvasEvent.CLICK, () => this.hideContainer());
    graph.on(NodeEvent.POINTER_LEAVE, () => this.hideContainer());
    graph.on(NodeEvent.POINTER_MOVE, this.onPointerMover.bind(this));
  }


  unbindEvents() {
    const { graph } = this.context;
    graph.off(NodeEvent.CONTEXT_MENU, this.onNodeContextMenu.bind(this));
    graph.off(CanvasEvent.CLICK, () => this.hideContainer());
    graph.off(NodeEvent.POINTER_LEAVE, () => this.hideContainer());
    graph.off(NodeEvent.POINTER_MOVE, this.onPointerMover.bind(this));
  }

  hideContainer = () => {
    this.container.style.display = 'none';
  }

  showContainer = (event: IPointerEvent, padding: { x: number, y: number } = { x: 0, y: 0 }) => {
    const { client } = event;
    this.container.style.left = `${client.x + padding.x}px`;
    this.container.style.top = `${client.y + padding.y}px`;
    this.container.style.display = 'block';
    const div = document.querySelector('#NodeTooltipBehavior') as HTMLElement;
    console.log("NodeContextMenuBehavior -> showContainer -> div", div)
    if (div) {
      div.style.display = 'none';
    }
  }

  hideCanvasContextMenu = () => {
    const div = document.querySelector('#CanvasContextMenuBehavior') as HTMLElement;
    if (div) {
      div.style.display = 'none';
    }
  }

  onNodeContextMenu(event: IPointerEvent) {
    event.preventDefault();
    const { graph } = this.context;
    const nodeId = ((event.target as unknown) as HTMLElement).id as string;
    const node = graph.getNodeData(nodeId) as (NodeData & { data?: ICanvasNode });

    const nodeData: ICanvasNode = {
      id: node.id as string,
      label: node.label as string,
      type: node.data?.type ?? '',
      properties: node.data?.properties as IProperties
    }

    const component: React.ReactNode = <NodeCard node={nodeData} extra={
      <div>
        <div className='px-3 mb-3 mt-2 h-5 flex items-center justify-between text-sm'>

          <ButtonWithTooltip
            variant="ghost"
            size="icon-sm"
            className="rounded-none "
            tooltip={<p>{"Focus Node"}</p>}
            onClick={() => {
              graph.focusElement(nodeData.id)
              this.hideContainer()
            }}
          >
            <CircleDot className="h-4 w-4" />
          </ButtonWithTooltip>
          <Separator orientation="vertical" className='h-6' />

          <ButtonWithTooltip
            variant="ghost"
            size="icon-sm"
            className="rounded-none  active:bg-gray:500"
            tooltip={<p>{"Start a query"}</p>}
          >
            <Terminal className="h-4 w-4" />
          </ButtonWithTooltip>

          <Separator orientation="vertical" className='h-6' />

          <ButtonWithTooltip
            variant="ghost"
            size="icon-sm"
            className="rounded-none  active:bg-gray:500"
            tooltip={<p>{"Tag this Node"}</p>}
          >
            <Tag className="h-4 w-4" />
          </ButtonWithTooltip>

          <Separator orientation="vertical" className='h-6' />

          <ButtonWithTooltip
            variant="ghost"
            size="icon-sm"
            className="rounded-none  active:bg-gray:500"
            tooltip={<p>{"Lock Node"}</p>}
          >
            <Lock className="h-4 w-4" />
          </ButtonWithTooltip>

          <Separator orientation="vertical" className='h-6' />

          <ButtonWithTooltip
            variant="ghost"
            size="icon-sm"
            className="rounded-none   active:bg-gray:500"
            tooltip={<p>{"Node Display settings"}</p>}
          >
            <Monitor className="h-4 w-4" />
          </ButtonWithTooltip>
        </div>
        <NestedMenu
          className='rounded-none w-[260px] shadow-none p-0 border-none'
          menuItems={menuItems}
        />
      </div>
    } />

    this.root.render(component)
    this.showContainer(event);
    this.hideCanvasContextMenu()
  }


  // onNodeMouseLeave(event: IPointerEvent) {
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

