import { useThemeStore } from "@invana/ui"
import { Graphin } from '@antv/graphin';
import { DRAG_CANVAS_BEHAVIOR, ZOOM_CANVAS_BEHAVIOR, DRAG_ELEMENT_BEHAVIOR, HOVER_ACTIVATE_BEHAVIOR, CLICK_SELECT_BEHAVIOR, LASSO_SELECT_BEHAVIOR, NODE_TOOLTIP_BEHAVIOR, EDGE_TOOLTIP_BEHAVIOR, NODE_CONTEXT_MENU_BEHAVIOR, EDGE_CONTEXT_MENU_BEHAVIOR, CANVAS_CONTEXT_MENU_BEHAVIOR, PROPERTY_VIEWER_BEHAVIOR } from "@invana/canvas-graph/defaults/behaviors";
import { D3_FORCE_LAYOUT } from "@invana/canvas-graph/defaults/layouts";
import { HISTORY_PLUGIN } from "@invana/canvas-graph/defaults/plugins";
import { PROCESS_PARALLEL_TRANSFORMER } from "@invana/canvas-graph/defaults/transforms";
import { DEFAULT_STYLE_OPTIONS } from "@invana/canvas-graph/manager/defaults";
import { CanvasManagerOptions } from "@invana/canvas-graph/manager/types";
import { CanvasGraph } from "@invana/canvas-graph";
import { lesMiserablesData, flightData, lesMiserablesDataRaw } from "@invana/example-datasets";
import { mergeDeep } from "@invana/data-store";
import { useRef } from "react";

const defaultOptions: CanvasManagerOptions = {
  behaviors: [
    DRAG_CANVAS_BEHAVIOR,
    ZOOM_CANVAS_BEHAVIOR,
    DRAG_ELEMENT_BEHAVIOR,
    HOVER_ACTIVATE_BEHAVIOR,
    CLICK_SELECT_BEHAVIOR,
    LASSO_SELECT_BEHAVIOR,
    NODE_TOOLTIP_BEHAVIOR,
    EDGE_TOOLTIP_BEHAVIOR,
    NODE_CONTEXT_MENU_BEHAVIOR,
    EDGE_CONTEXT_MENU_BEHAVIOR,
    CANVAS_CONTEXT_MENU_BEHAVIOR,
    {
      ...PROPERTY_VIEWER_BEHAVIOR,
      className: 'top-[44px] right-[0px] w-[320px] h-[calc(100vh-72px)]'
    }
  ],
  transforms: [
    // MAP_NODE_SIZE_TRANSFORMER,
    PROCESS_PARALLEL_TRANSFORMER
  ],
  plugins: [
    // MINIMAP_PLUGIN,
    HISTORY_PLUGIN,
    // GRID_PLUGIN
  ],
  layout: D3_FORCE_LAYOUT,
  styles: DEFAULT_STYLE_OPTIONS
}

const graphModelOptions: CanvasManagerOptions = {
  behaviors: [
    DRAG_CANVAS_BEHAVIOR,
    // ZOOM_CANVAS_BEHAVIOR,
    DRAG_ELEMENT_BEHAVIOR,
    // HOVER_ACTIVATE_BEHAVIOR,
    // CLICK_SELECT_BEHAVIOR,
    // LASSO_SELECT_BEHAVIOR,
    // NODE_TOOLTIP_BEHAVIOR,
    // EDGE_TOOLTIP_BEHAVIOR,
    // NODE_CONTEXT_MENU_BEHAVIOR,
    // EDGE_CONTEXT_MENU_BEHAVIOR,
    // CANVAS_CONTEXT_MENU_BEHAVIOR,
    // {
    //   ...PROPERTY_VIEWER_BEHAVIOR,
    //   className: 'top-[44px] right-[0px] w-[320px] h-[calc(100vh-72px)]'
    // }
  ],
  transforms: [
    // MAP_NODE_SIZE_TRANSFORMER,
    // PROCESS_PARALLEL_TRANSFORMER
  ],
  plugins: [
    // MINIMAP_PLUGIN,
    // HISTORY_PLUGIN,
  ],
  layout: D3_FORCE_LAYOUT,
  // styles: DEFAULT_MODEL_STYLE_OPTIONS
};


export const TestPage: React.FC = () => {

  const { theme, } = useThemeStore()

  const graphRef: React.MutableRefObject<typeof CanvasGraph | null> = useRef(null)
  const modelRef: React.MutableRefObject<typeof CanvasGraph | null> = useRef(null)

  return <div style={{ "background": '#222' }} className="h-screen w-screen flex items-center justify-center bg-background text-foreground">

    {/* <div style={{ display: 'flex', gap: '20px' }}> */}
    <div style={{ width: '50%', height: '400px' }}>
      <Graphin
        // ref={graphRef}
        // graphName={'graphData'}
        // containerStyle={{ width: "100%", height: "100%" }}
        // className={"bg-background"}
        // initData={lesMiserablesData}
        // onReady={(canvasManager: CanvasManager) => {
        //   console.log("CanvasGraph.onReady", canvasManager)
        //   canvasManagerRef.current = canvasManager;
        //   setIsReady(true)
        // }}
        onDestroy={() => {
          console.log("CanvasGraph.onDestroy")
          // setIsReady(false)
          // canvasManagerRef.current = null;
        }}
        options={{ data: lesMiserablesDataRaw, ...defaultOptions }}
      />
    </div>
    <div style={{ width: '50%', height: '400px' }}>
      <Graphin
        // ref={modelRef}
        // graphName={'modelData'}
        // containerStyle={{ width: "100%", height: "100%" }}
        // className={"bg-background"}
        // initData={flightData}


        options={{ data: lesMiserablesDataRaw, ...graphModelOptions }}
      />
    </div>
    {/* </div> */}


  </div>
}