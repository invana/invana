
import { LeftNavItem, useThemeStore } from '@invana/ui';
import { DefaultLayout } from '@invana/ui/themes/default/default';
import { useDefaultLayoutStore } from '@invana/ui/themes/default/store';
import { Activity, MonitorCog, Network, Terminal } from 'lucide-react';
import { Button } from '@invana/ui';
import { useState, useRef, useEffect } from 'react';
import { ProductName } from '@/constants';
import { CanvasGraph } from '@invana/canvas-graph';
import { flightData } from '@invana/example-datasets'
import AppHeaderRight from '@/ui/header/app-header-right';
import { QueryForm } from '@/ui/forms/query-form';
import { PanelContent } from '@invana/ui/components/theme/panel-content';
import { ActivityHistoryView } from '@/ui/components/activity-history';
import { CanvasManagerOptions } from '@invana/canvas-graph/manager/types';
import { CanvasGraphProps } from '@invana/canvas-graph';
import {
  CANVAS_CONTEXT_MENU_BEHAVIOR, CLICK_SELECT_BEHAVIOR, DRAG_CANVAS_BEHAVIOR,
  DRAG_ELEMENT_BEHAVIOR, EDGE_CONTEXT_MENU_BEHAVIOR, EDGE_TOOLTIP_BEHAVIOR,
  HOVER_ACTIVATE_BEHAVIOR, LASSO_SELECT_BEHAVIOR, NODE_CONTEXT_MENU_BEHAVIOR,
  NODE_TOOLTIP_BEHAVIOR, PROPERTY_VIEWER_BEHAVIOR, ZOOM_CANVAS_BEHAVIOR
} from '@invana/canvas-graph/defaults/behaviors';
import { MAP_NODE_SIZE_TRANSFORMER } from '@invana/canvas-graph/defaults/transforms';
import { MINIMAP_PLUGIN, HISTORY_PLUGIN } from '@invana/canvas-graph/defaults/plugins';
import { GRID_LAYOUT } from '@invana/canvas-graph/defaults/layouts';
import { ExtensionCategory, Graph, register } from '@antv/g6';
import { EdgeTooltipBehavior, NodeTooltipBehavior, PropertyViewerBehavior } from '@invana/canvas-graph/behaviours';
import { NodeContextMenuBehavior } from '@invana/canvas-graph/behaviours/context-menus/node';
import { EdgeContextMenuBehavior } from '@invana/canvas-graph/behaviours/context-menus/edge';
import { CanvasContextMenuBehavior } from '@invana/canvas-graph/behaviours/context-menus/canvas';
import { CanvasManager } from '@invana/canvas-graph/manager';
import { DEFAULT_STYLE_OPTIONS } from '@invana/canvas-graph/manager/defaults';
import { CanvasToolBar } from '@invana/canvas-graph/plugins';


register(ExtensionCategory.BEHAVIOR, 'tooltip-node', NodeTooltipBehavior, true);
register(ExtensionCategory.BEHAVIOR, 'tooltip-edge', EdgeTooltipBehavior, true);
register(ExtensionCategory.BEHAVIOR, 'node-context-menu', NodeContextMenuBehavior, true);
register(ExtensionCategory.BEHAVIOR, 'edge-context-menu', EdgeContextMenuBehavior, true);
register(ExtensionCategory.BEHAVIOR, 'canvas-context-menu', CanvasContextMenuBehavior, true);
register(ExtensionCategory.BEHAVIOR, 'property-viewer', PropertyViewerBehavior, true);


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
    // MAP_NODE_SIZE_TRANSFORMER
  ],
  plugins: [
    MINIMAP_PLUGIN,
    HISTORY_PLUGIN,
    // GRID_PLUGIN
  ],
  layout: GRID_LAYOUT,
  styles: DEFAULT_STYLE_OPTIONS
}


const ExplorerPage: React.FC = () => {



  const [isReady, setIsReady] = useState(false);
  const canvasManagerRef = useRef<CanvasManager | null>(null);
  // const canvasGraphRef = useRef<{
  //   getGraph: () => Graph
  //   // getGraphManager: () => CanvasManager
  // } | null>(null);
  // const canvasGraphRef = useRef<CanvasGraphProps>(null);
  // const canvasManagerRef = useRef(null);

  const { theme, } = useThemeStore()


  const {
    leftContentName,
    setLeftContentName,
    bottomContentName,
    toggleLeftContent,
    toggleBottomContent,
    // mainTopContentSize, leftContentSize
  } = useDefaultLayoutStore()



  const topNavItems: LeftNavItem[] = [
    {
      icon: Network,
      name: "Model",
      key: "model",
      onClick: () => {
        return toggleLeftContent("model")
      },
    },
    {
      name: "Query",
      key: "query",
      onClick: () => {
        return toggleLeftContent("query")
      },
      icon: Terminal
    },
    // {
    //   icon: Book,
    //   key: "documentation",
    //   name: "documentation",
    //   onClick: () => {
    //     console.log("Clicked:", "Documentation")
    //   }
    // },
    // { name: "Modeller", key: 'modeller', href: "/modeller", icon: Network },
    // { name: "Data Management", href: "/connections", icon: Database },
    {
      name: "Activity History",
      key: 'activity-history',
      onClick: () => {
        return toggleLeftContent("activity-history")
      },
      icon: Activity
    },
    { name: "Display Settings", key: 'display-settings', href: "#", icon: MonitorCog },

  ]

  const options = { ...defaultOptions }

  // if (options.behaviors) {
  //   options.behaviors = options.behaviors.filter(b => b !== 'property-viewer');

  //   options.behaviors.push({
  //     key: 'property-viewer',
  //     type: 'property-viewer',
  //     className: 'top-[44px] right-[0px] w-[320px] h-[calc(100vh-72px)]',
  //   });
  // }


  // useEffect(() => {
  //   console.log("mainTopContentSize or leftContentSize updated ", mainTopContentSize, leftContentSize)
  //   const graph = canvasManagerRef.current?.getGraph();
  //   if (graph && isReady) {

  //     graph.resize();
  //     graph.layout();
  //     graph.render();
  //     graph.fitView();
  //   }
  // }, [mainTopContentSize, leftContentSize, isReady]);


  // useEffect(() => {
  //   console.log("theme updated====== ", theme, canvasManagerRef.current, isReady)
  //   if (canvasManagerRef.current && isReady) {
  //     // const canvasManager = canvasGraphRef.current.getGraphManager();
  //     console.log("getUpdatedStylingOptions, theme", theme)
  //     canvasManagerRef.current.setTheme(theme)
  //   }
  // }, [theme, isReady]);

  return <DefaultLayout
    headerProps={{
      left: (
        <>
          {/* <span className='ml-3'><Compass className='w-5 h-5' /></span> */}
          <span className='font-bold mr-2 ml-3'>{ProductName}</span>
          <span className='mr-2'>|</span>
          <span>Explorer</span>
        </>
      ),
      center: (
        <>
          {isReady && canvasManagerRef.current ? <CanvasToolBar getCanvasManager={() => canvasManagerRef.current!} /> : null}
        </>
      ),
      right: (
        <>
          <AppHeaderRight />
        </>
      )
    }}

    leftNavProps={{
      topNavItems: topNavItems,
    }}
    leftContent={
      <div className="space-y-2 ">
        {leftContentName === "model" &&
          <PanelContent title={"Model"} onClose={() => setLeftContentName(undefined)} showClose>
            <div className='h-full px-3 py-2'>
              <p >Graph model comes here</p>
            </div>
          </PanelContent>
        }
        {leftContentName === "query" &&
          <PanelContent title={"Query Console"} onClose={() => setLeftContentName(undefined)} showClose>
            <QueryForm className=' ' />
          </PanelContent>
        }
        {leftContentName === "activity-history" &&
          <PanelContent title={"Activity History"} onClose={() => setLeftContentName(undefined)} showClose>
            <ActivityHistoryView className='p-3 mb-3 h-[calc(100vh-80px)] ' />
          </PanelContent>
        }
        {leftContentName === "display-settings" &&
          <PanelContent title={"Display Settings"} onClose={() => setLeftContentName(undefined)} showClose>
            <p>Display Settings here </p>
          </PanelContent>
        }
      </div>
    }
    mainTopContent={

      // <div className="flex h-full items-center justify-center ">

      <CanvasGraph
        // ref={canvasGraphRef}
        containerStyle={{ width: "100%", height: "100%" }}
        className={"bg-background"}
        initData={flightData}
        onReady={(canvasManager: CanvasManager) => {
          console.log("CanvasGraph.onReady", canvasManager)
          canvasManagerRef.current = canvasManager;
          setIsReady(true)
        }}
        onDestroy={() => {
          console.log("CanvasGraph.onDestroy")
          setIsReady(false)
          canvasManagerRef.current = null;
        }}
        options={options}
      />

      // </div>
    }
    mainBottomContent={
      <>
        <Button size={"sm"} onClick={() => toggleBottomContent('query')}>Toggle Bottom {bottomContentName}</Button>
      </>
    }
    rightContent={
      <></>
    }




  />


}

export default ExplorerPage;