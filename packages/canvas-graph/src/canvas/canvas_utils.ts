import { ALL_AVAILABLE_LAYOUTS } from "../defaults/layouts";
import { CanvasManager } from "./manager";


export class GraphCanvasUtils {

  private canvas_manager: CanvasManager

  constructor(canvas_manager: CanvasManager) {
    this.canvas_manager = canvas_manager
  }

  getGraph() {
    return this.canvas_manager.getGraph();
  }

  zoomIn() {
    const currentZoom = this.getGraph()?.getZoom();
    if (currentZoom)
      this.getGraph()?.zoomTo(currentZoom + 0.2);
  }

  zoomOut() {
    const currentZoom = this.getGraph()?.getZoom();
    if (currentZoom)
      this.getGraph()?.zoomTo(currentZoom - 0.2);
  }

  fitView() {
    this.getGraph()?.fitView();
  }

  eraseCanvas() {
    this.canvas_manager.store.clear();
    // this.getGraph()?.clear();
  }

  reDraw() {
    this.getGraph()?.layout();
  }

  updateLayout = (layoutName: string) => {
    const layoutConfig = ALL_AVAILABLE_LAYOUTS.find((item) => item.type === layoutName);
    if (layoutConfig) {
      this.getGraph()?.setLayout(layoutConfig);
      this.getGraph()?.render()
    }
  }

}