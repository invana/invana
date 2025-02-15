import { BaseBehavior } from '@antv/g6';
import type { BaseBehaviorOptions, RuntimeContext, IPointerEvent } from '@antv/g6';
import { createRoot, Root } from 'react-dom/client';


export interface CanvasBaseBehaviorOptions extends BaseBehaviorOptions {
  className?: string;
  containerId: string
}

export abstract class CanvasBaseBehavior extends BaseBehavior {
  // DONT USE THIS YET - NOT WORKING
  container!: HTMLDivElement;
  root!: Root;

  constructor(context: RuntimeContext, options: CanvasBaseBehaviorOptions) {
    super(context, options);
    this.createContainer();
    this.root = createRoot(this.container);
    this.bindEvents();
  }

  abstract bindEvents(): void;
  abstract unbindEvents(): void;

  createContainer() {
    this.container = document.createElement('div');
    // if (this.options.containerId) {
    //   this.container.id = this.options.containerId;
    // }
    this.container.style.position = 'absolute';
    this.container.style.pointerEvents = 'none';
    document.body.appendChild(this.container);
  }

  hideContainer = () => {
    this.container.style.display = 'none';
  }

  showContainer = (event: IPointerEvent, padding: { x: 0, y: 0 }) => {
    const { client } = event;
    this.container.style.left = `${client.x + padding.x}px`;
    this.container.style.top = `${client.y + padding.y}px`;
    this.container.style.display = 'block';
  }

  destroy(): void {
    this.root.unmount();
    this.unbindEvents();
  }

}