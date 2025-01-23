import { BaseContextMenu } from "./abstract";
import { CanvasEvent, NodeEvent } from '@antv/g6';


export class NodeContextMenu extends BaseContextMenu {
  protected bindEvents() {
    if (!this.graph) return;

    console.log("contextMenu set")
    this.graph.on(NodeEvent.CONTEXT_MENU, (evt: any) => {
      evt.preventDefault();
      console.log('CONTEXT_MENU event', evt);
      const { canvas, target } = evt;
      console.log("CONTEXT_MENU canvasX, canvasY", canvas.x, canvas.y, target);
      const content = `
        <div style="padding: 8px; cursor: pointer;" data-action="edit">Edit Node</div>
        <div style="padding: 8px; cursor: pointer;" data-action="delete">Delete Node</div>
      `;
      this.showMenu(canvas.x, canvas.y, content);
    });

    this.graph.on(CanvasEvent.CLICK, () => this.hideMenu());
  }

  protected handleMenuClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const action = target.getAttribute('data-action');
    console.log('Node action:', action);

    // const graph = this.graph;
    // const selectedNodes = this.graph?.findAllByState('node', 'selected');
    // const item = selectedNodes?.[0];

    // if (action === 'edit') {
    //   console.log('Edit node:', item?.getModel());
    // } else if (action === 'delete' && graph && item) {
    //   // graph.remove(item);
    // }

    this.hideMenu();
  }
}
