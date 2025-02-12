import { useThemeStore } from '@invana/ui';
import { DefaultV2Layout } from '@invana/ui/themes/layout-v2/layout';
import { useDefaultV2LayoutStore } from '@invana/ui/themes/layout-v2/store';
import {
  Activity, Book, Box, Brush, CircleDashed, Eraser, LassoSelect,
  LayoutGrid, LifeBuoy, Lock, Menu, MonitorCog, Network, RefreshCw, Share2,
  Shrink, SquareMenu, Terminal, Type, ZoomIn, ZoomOut
} from 'lucide-react';
import { Button } from '@invana/ui';
import React, { useState, useRef, useEffect } from 'react';
import { ProductName } from '@/constants';
import { CanvasGraph } from '@invana/canvas-graph';
import AppHeaderRight from '@/ui/header/app-header-right';
import { QueryForm } from '@/ui/forms/query-form';
import { PanelContent } from '@invana/ui/components/theme/panel-content';
import { ActivityHistoryView } from '@/ui/components/activity-history';
import { CanvasManagerOptions } from '@invana/canvas-graph/manager/types';
import {
  CANVAS_CONTEXT_MENU_BEHAVIOR, CLICK_SELECT_BEHAVIOR, DRAG_CANVAS_BEHAVIOR,
  DRAG_ELEMENT_BEHAVIOR, EDGE_CONTEXT_MENU_BEHAVIOR, EDGE_TOOLTIP_BEHAVIOR,
  HOVER_ACTIVATE_BEHAVIOR, LASSO_SELECT_BEHAVIOR, NODE_CONTEXT_MENU_BEHAVIOR,
  NODE_TOOLTIP_BEHAVIOR, PROPERTY_VIEWER_BEHAVIOR, ZOOM_CANVAS_BEHAVIOR
} from '@invana/canvas-graph/defaults/behaviors';
import {
  MAP_NODE_SIZE_TRANSFORMER,
  PROCESS_PARALLEL_TRANSFORMER
} from '@invana/canvas-graph/defaults/transforms';
import { HISTORY_PLUGIN } from '@invana/canvas-graph/defaults/plugins';
import { D3_FORCE_LAYOUT } from '@invana/canvas-graph/defaults/layouts';
import { ExtensionCategory, register } from '@antv/g6';
import {
  EdgeTooltipBehavior, NodeTooltipBehavior,
  PropertyViewerBehavior
} from '@invana/canvas-graph/behaviours';
import { NodeContextMenuBehavior } from '@invana/canvas-graph/behaviours/context-menus/node';
import { EdgeContextMenuBehavior } from '@invana/canvas-graph/behaviours/context-menus/edge';
import { CanvasContextMenuBehavior } from '@invana/canvas-graph/behaviours/context-menus/canvas';
import { CanvasManager } from '@invana/canvas-graph/manager';
import { DEFAULT_MODEL_STYLE_OPTIONS, DEFAULT_STYLE_OPTIONS } from '@invana/canvas-graph/manager/defaults';
import { GraphInformation } from '@/ui/components/graph-information';
import { LeftNavItem } from '@invana/ui/components/theme/left-nav-items';
import { projectsListDataSet } from '@/projectsList';
import { ProjectSwitcher } from '@/ui/components/projects-switcher';
import { useParams } from 'react-router-dom';
import { mergeDeep } from '@invana/data-store';
import { Project } from '@/store/projectStore';
import useConnections from '@/hooks/useConnection';
import WelcomeView from '@/ui/components/welcome-view';

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
    MAP_NODE_SIZE_TRANSFORMER,
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
    NODE_TOOLTIP_BEHAVIOR,
    EDGE_TOOLTIP_BEHAVIOR,
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
  styles: DEFAULT_MODEL_STYLE_OPTIONS
};


const ExplorerPage: React.FC = () => {
  const { graphId } = useParams();


  const { getActiveConnection } = useConnections();

  console.log("=====graphId", graphId)
  const [isReady, setIsReady] = useState(false);
  const canvasManagerRef = useRef<CanvasManager | null>(null);
  const { theme, } = useThemeStore()


  const projectData: Project | undefined = projectsListDataSet.find((project) => project.id === graphId)

  console.log("projectData", projectData)
  const {
    rightContentName,
    setRightContentName,
    bottomContentName,
    toggleRightContent,
    toggleBottomContent,
  } = useDefaultV2LayoutStore()

  const rightTopNavItems: LeftNavItem[] = [
    {
      icon: Box,
      name: "Graph Information",
      className: "my-1.5 mt-5",
      iconClassName: "w-5 h-5",
      tooltipSide: "right",
      onClick: () => {
        return toggleRightContent("graph-info")
      },
    },
    {
      icon: Network,
      name: "Model",
      className: "my-1.5",
      iconClassName: "w-5 h-5",
      tooltipSide: "right",
      onClick: () => {
        return toggleRightContent("model")
      },
    },
    {
      name: "Query",
      className: "my-1.5",
      iconClassName: "w-5 h-5",
      tooltipSide: "right",
      onClick: () => {
        return toggleRightContent("query")
      },
      icon: Terminal
    },
    {
      icon: Book,
      name: "Documentation",
      className: "my-1.5",
      iconClassName: "w-5 h-5",
      tooltipSide: "right",
      onClick: () => {
        console.log("Clicked:", "Documentation")
      }
    },
    // { name: "Modeller", key: 'modeller', href: "/modeller", icon: Network },
    // { name: "Data Management", href: "/connections", icon: Database },
    {
      name: "Activity History",
      className: "my-1.5",
      iconClassName: "w-5 h-5",
      tooltipSide: "right",
      onClick: () => {
        return toggleRightContent("activity-history")
      },
      icon: Activity
    },
    {
      name: "Display Settings",
      iconClassName: "w-5 h-5",
      href: "#",
      tooltipSide: "right",
      icon: MonitorCog
    },
    {
      icon: SquareMenu,
      name: "Property Viewer",
      className: "my-1.5",
      iconClassName: "w-5 h-5",
      tooltipSide: "right",
      onClick: () => {
        console.log("Clicked:", "Property Viewer")
      }
    },
  ]


  const leftTopNavItems: LeftNavItem[] = [
    {
      icon: LassoSelect,
      name: "Lasso select",
      className: 'my-1 mt-5',
      iconStroke: 2,
      tooltipSide: "left",
      // className: "p-0",
      onClick: () => {
        // return toggleRightContent("graph-info")
      },
    },
    {
      icon: Brush,
      name: "Brush",
      className: 'my-1',
      iconStroke: 2,
      tooltipSide: "left",
      // className: "p-0",
      onClick: () => {
        // return toggleRightContent("graph-info")
      },
    },
    {
      icon: Type,
      name: "Add Comment",
      className: 'my-1 mb-3',
      showSeperator: true,
      iconStroke: 2,
      tooltipSide: "left",
      onClick: () => {
        // return toggleRightContent("graph-info")
      },
    },

    {
      icon: Share2,
      name: "D3 Force layout",
      className: 'my-1 mt-3',
      iconStroke: 2,
      tooltipSide: "left",
      onClick: () => canvasManagerRef.current?.canvas_utils.updateLayout('d3-force'),
    },
    {
      icon: CircleDashed,
      name: "Circular Layout",
      className: 'my-1',
      iconStroke: 2,
      tooltipSide: "left",
      onClick: () => canvasManagerRef.current?.canvas_utils.updateLayout('circular'),
    },
    {
      icon: LayoutGrid,
      name: "Grid Layout",
      className: 'my-1',
      iconStroke: 2,
      tooltipSide: "left",
      onClick: () => canvasManagerRef.current?.canvas_utils.updateLayout('grid'),
    },
    {
      icon: Network,
      name: "Dagre layout",
      showSeperator: true,
      className: 'my-1 mb-3',
      iconStroke: 2,
      tooltipSide: "left",
      onClick: () => canvasManagerRef.current?.canvas_utils.updateLayout('antv-dagre'),
    },
    {
      icon: Eraser,
      name: "Eraser",
      className: 'my-1',
      iconStroke: 2,
      tooltipSide: "left",
      onClick: () => canvasManagerRef.current?.canvas_utils.eraseCanvas(),
    },
    {
      icon: RefreshCw,
      name: "Re draw",
      className: 'my-1',
      iconStroke: 2,
      tooltipSide: "left",
      onClick: () => canvasManagerRef.current?.canvas_utils.reDraw(),
    },
    {
      icon: Shrink,
      name: "Fit view ",
      className: 'my-1',
      iconStroke: 2,
      tooltipSide: "left",
      onClick: () => canvasManagerRef.current?.canvas_utils.fitView(),
    },
    {
      icon: Lock,
      name: "Lock",
      className: 'my-1 mb-3',
      showSeperator: true,
      iconStroke: 2,
      tooltipSide: "left",
      onClick: () => {
        // return toggleRightContent("graph-info")
      },
    },
  ]

  const leftBottomNavItems: LeftNavItem[] = [
    {
      icon: ZoomIn,
      name: "Zoom In",
      className: 'my-1',
      iconStroke: 2,
      tooltipSide: "right",
      onClick: () => canvasManagerRef.current?.canvas_utils.zoomIn(),
    },
    {
      icon: ZoomOut,
      name: "Zoom Out",
      className: 'my-1 mb-3',
      showSeperator: true,
      iconStroke: 2,
      tooltipSide: "right",
      onClick: () => canvasManagerRef.current?.canvas_utils.zoomOut(),
    }
  ]
  useEffect(() => {
    // console.log("theme updated====== ", theme, canvasManagerRef.current, isReady)
    if (canvasManagerRef.current && isReady) {
      // console.log("getUpdatedStylingOptions, theme", theme)
      canvasManagerRef.current.setTheme(theme)
    }
  }, [theme, isReady]);

  const getSchemaGraphData = () => {
    return canvasManagerRef.current?.getModelAsGraphData();
  }

  // useEffect(() => {
  //   setRightContentName("graph-info")
  // }, [])

  // useEffect(() => {
  //   console.log("rightContentName", rightContentName)
  //   if (rightContentName === undefined) {
  //     setRightContentSize(0)
  //     // canvasManagerRef.current?.getGraph().resize()
  //     canvasManagerRef.current?.getGraph().fitView()

  //     // canvasManagerRef.current?.render()
  //   } else {
  //     console.log("====")
  //   }
  // }, [rightContentName, setRightContentSize])

  return <DefaultV2Layout
    headerProps={{
      left: (
        <>
          <span className='ml-3'><Menu className='w-5 h-5' /></span>
          <span className='font-bold mr-2 ml-2'>{ProductName}</span>
          <span className='mr-2'>|</span>
          <span>Explorer</span>
        </>
      ),
      center: (
        <>
          {/* {isReady && canvasManagerRef.current ? <CanvasToolBar getCanvasManager={() => canvasManagerRef.current!} /> : null} */}

          <ProjectSwitcher />
        </>
      ),
      right: (
        <>
          <AppHeaderRight />
        </>
      )
    }}

    leftContent={
      <></>
    }

    leftNavProps={{
      topNavItems: leftTopNavItems,
      bottomNavItems: leftBottomNavItems

    }}
    rightNavProps={{
      topNavItems: rightTopNavItems,
      bottomNavItems: [
        {
          icon: LifeBuoy,
          name: "Help",
          className: 'my-1',
          iconStroke: 2,
          onClick: () => {
            // return toggleRightContent("graph-info")
          },
        }
      ]
    }}
    rightContent={
      <div className="space-y-2 h-full">
        {rightContentName === "graph-info" &&
          <PanelContent title={"Graph Information"} key={'graph-info-panel'}
            onClose={() => setRightContentName(undefined)}
            bodyClassName='h-[calc(100vh-70px)] '
            showClose>
            {canvasManagerRef.current && projectData &&
              <GraphInformation
                key={'graph-info'}
                canvasManager={canvasManagerRef.current}
                project={projectData}
              />}
          </PanelContent>
        }
        {rightContentName === "model" &&
          <PanelContent title={"Model"} key={'model-panel'} onClose={() => setRightContentName(undefined)} showClose>
            {projectData && canvasManagerRef.current ?
              <CanvasGraph
                // ref={modelGraphData}
                graphName={'model'}
                containerStyle={{ width: "100%", height: "calc(100vh - 70px)" }}
                className={"bg-background"}
                showHeader={false}
                initData={getSchemaGraphData()}
                options={mergeDeep(graphModelOptions, projectData.options || {})}

              /> : <></>
            }
          </PanelContent>
        }
        {rightContentName === "query" &&
          <PanelContent title={"Query Console"} key={'query-panel'} onClose={() => setRightContentName(undefined)} showClose>
            <QueryForm className=' ' />
          </PanelContent>
        }
        {rightContentName === "activity-history" &&
          <PanelContent title={"Activity History"} key={'activity-panel'} onClose={() => setRightContentName(undefined)} showClose>
            <ActivityHistoryView className='p-3 mb-3 h-[calc(100vh-80px)] ' />
          </PanelContent>
        }
        {rightContentName === "display-settings" &&
          <PanelContent title={"Display Settings"} key={'display-panel'} onClose={() => setRightContentName(undefined)} showClose>
            <p>Display Settings here </p>
          </PanelContent>
        }
      </div>
    }
    mainTopContent={
      // <div className="flex h-full items-center justify-center ">
      projectData ?
        <CanvasGraph
          // ref={canvasGraphRef}
          graphName={'graphData'}
          containerStyle={{ width: "100%", height: "100%" }}
          className={"bg-background"}
          initData={projectData.data}
          onReady={(canvasManager: CanvasManager) => {
            console.log("CanvasGraph.onReady", canvasManager)
            canvasManagerRef.current = canvasManager;
            setIsReady(true)
          }}
          onDestroy={() => {
            console.log("CanvasGraph.onDestroy")
            // setIsReady(false)
            // canvasManagerRef.current = null;
          }}
          options={mergeDeep(defaultOptions, projectData.options || {})}
        />
        : <WelcomeView />
      // </div>
    }
    mainBottomContent={
      <>
        <Button size={"sm"} onClick={() => toggleBottomContent('query')}>Toggle Bottom {bottomContentName}</Button>
      </>
    }
  // rightContent={
  //   <></>
  // }




  />


}

export default ExplorerPage;