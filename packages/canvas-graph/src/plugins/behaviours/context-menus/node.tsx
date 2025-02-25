import { BaseBehavior, CanvasEvent, NodeEvent } from '@antv/g6';
import type { BaseBehaviorOptions, IPointerEvent, RuntimeContext } from '@antv/g6';
import { createRoot, Root } from 'react-dom/client';
import { ICanvasNode, IProperties } from '@invana/data-store';
import { ButtonWithTooltip, MenuItem, NestedMenu, Separator } from '@invana/ui';
import { NodeCard } from '@invana/ui';
import React from 'react';
import { CanvasGraphNode } from '@invana/canvas-graph/types';




/*

      {
        ...CANVAS_CONTEXT_MENU_BEHAVIOR,
        menuItems: [
          {
            id: 'files',
            label: 'Display Settings',
            icon: FolderOpen,
            shortcut: '⌘F'
          },
          {
            id: 'Run Analysis',
            label: 'Run Analysis',
            icon: Settings,
            shortcut: '⌘,'
          }
        ]
      }
*/

export interface NodeContextMenuOptions extends BaseBehaviorOptions {
  className?: string;
  menuItems?: MenuItem[];
  createMainMenuItemsFn?(event: IPointerEvent): MenuItem[];
  createMenuItemsFn?(event: IPointerEvent): MenuItem[];
}

export class NodeContextMenuBehavior extends BaseBehavior {

  container!: HTMLElement;
  root!: Root

  static defaultOptions: Partial<NodeContextMenuOptions> = {
    className: '',
    menuItems: [],
    createMenuItemsFn: (event: IPointerEvent) => [],
    createMainMenuItemsFn: (event: IPointerEvent) => []
  };

  constructor(context: RuntimeContext, options: NodeContextMenuOptions) {
    super(context, Object.assign({}, NodeContextMenuBehavior.defaultOptions, options));
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
    const node = graph.getNodeData(nodeId) as (CanvasGraphNode);

    const nodeData: ICanvasNode = {
      id: node.id as string,
      label: node.label as string,
      type: node.data?.type ?? '',
      properties: node.data?.properties as IProperties
    }
    const { createMenuItemsFn, createMainMenuItemsFn } = this.options;
    const menuItems = this.options.createMenuItemsFn ? createMenuItemsFn(event) : this.options.menuItems;
    const mainMenuItems = createMainMenuItemsFn(event)

    console.log("====mainMenuItems", mainMenuItems)


    const component: React.ReactNode = <NodeCard node={nodeData} extra={
      <div>
        {mainMenuItems.length > 0 &&
          <div className='px-3 mb-3 mt-2 h-5 flex items-center justify-between text-sm'>
            {
              mainMenuItems.map((menuItem: MenuItem, index: number) => {
                return <>
                  <ButtonWithTooltip
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-none  active:bg-gray:500"
                    tooltip={<p>{menuItem.label}</p>}
                    onClick={() => {
                      menuItem?.onClick?.()
                      this.hideContainer()
                    }}
                  >
                    {menuItem.icon && <menuItem.icon className="h-4 w-4" />}
                    {/* {menuItem.label} */}
                  </ButtonWithTooltip>
                  {index !== mainMenuItems.length - 1 && <Separator orientation="vertical" className='h-6' />}
                </>
              })}
          </div>
        }
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

  destroy() {
    this.root.unmount();
    document.body.removeChild(this.container);
    this.unbindEvents();
  }

}

