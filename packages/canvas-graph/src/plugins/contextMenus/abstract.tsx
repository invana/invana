import { Graph } from '@antv/g6';

export abstract class BaseContextMenu {
  protected container: HTMLElement | null = null;
  protected graph: Graph | null = null;

  constructor() {
    this.container = document.createElement('div');
    this.container.style.position = 'absolute';
    this.container.style.display = 'none';
    // this.container.style.backgroundColor = '#fff';
    // this.container.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.15)';
    // this.container.style.borderRadius = '4px';
    // this.container.style.padding = '8px';
    this.container.style.zIndex = '1000';
    document.body.appendChild(this.container);
  }

  init(graph: Graph) {
    this.graph = graph;
    this.bindEvents();
  }

  protected abstract bindEvents(): void;

  protected showMenu(x: number, y: number, content: string) {
    if (!this.container) return;

    this.container.innerHTML = content;
    this.container.style.left = `${x}px`;
    this.container.style.top = `${y}px`;
    this.container.style.display = 'block';

    this.container.onclick = (event: MouseEvent) => this.handleMenuClick(event);
  }

  protected hideMenu() {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  protected abstract handleMenuClick(event: MouseEvent): void;

  destroy() {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.graph = null;
  }
}
