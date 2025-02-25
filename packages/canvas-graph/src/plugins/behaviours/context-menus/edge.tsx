import { BaseBehavior, CanvasEvent, EdgeEvent } from '@antv/g6';
import type { BaseBehaviorOptions, IPointerEvent, RuntimeContext } from '@antv/g6';
import { createRoot, Root } from 'react-dom/client';
import { ICanvasEdge, IProperties } from '@invana/data-store';
import { ButtonWithTooltip, MenuItem, NestedMenu, Separator } from '@invana/ui';
import { EdgeCard } from '@invana/ui';
import React from 'react';
import { CanvasGraphEdge } from '@invana/canvas-graph/types';


export interface EdgeContextMenuOptions extends BaseBehaviorOptions {
  className?: string;
  createMainMenuItemsFn?(event: IPointerEvent): MenuItem[];
  createMenuItemsFn(event: IPointerEvent): MenuItem[];
}


export class EdgeContextMenuBehavior extends BaseBehavior {

  container!: HTMLElement;
  root!: Root

  static defaultOptions: Partial<EdgeContextMenuOptions> = {
    className: '',
    createMenuItemsFn: (_: IPointerEvent) => [],
    createMainMenuItemsFn: (_: IPointerEvent) => []
  };

  constructor(context: RuntimeContext, options: EdgeContextMenuOptions) {
    super(context, Object.assign({}, EdgeContextMenuBehavior.defaultOptions, options));
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
    this.container.style.zIndex = '10';
    document.body.prepend(this.container);
  }


  onPointerMover = (_: IPointerEvent) => {
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
    const div = document.querySelector('#EdgeTooltipBehavior') as HTMLElement;
    console.log("EdgeContextMenuBehavior -> showContainer -> div", div)
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

  onEdgeContextMenu(event: IPointerEvent) {
    event.preventDefault();
    const { graph } = this.context;
    const edgeId = ((event.target as unknown) as HTMLElement).id as string;
    const edge = graph.getEdgeData(edgeId) as (CanvasGraphEdge);

    const edgeData: ICanvasEdge = {
      id: edge.id as string,
      label: edge.label as string,
      type: edge.data?.type ?? '',
      source: edge.source,
      target: edge.target,
      properties: edge.data?.properties as IProperties
    }
    // const { menuItems } = this.options;
    const { createMenuItemsFn, createMainMenuItemsFn } = this.options;
    const menuItems = createMenuItemsFn(event)
    const mainMenuItems = createMainMenuItemsFn(event)

    const component: React.ReactNode = <EdgeCard
      edge={edgeData}
      extra={
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
      }
    />

    this.root.render(component)
    this.showContainer(event);
    this.hideCanvasContextMenu()
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

