import { MenuItem, useThemeStore } from '@invana/ui';
import { DefaultV2Layout } from '@invana/ui/themes/layout-v2/layout';
import { useDefaultV2LayoutStore } from '@invana/ui/themes/layout-v2/store';
import {
  Activity, Bell, Book, Box, Brush, Circle, CircleDashed, CircleDot, Eraser, EyeOff, FileText, FolderOpen, LassoSelect,
  LayoutGrid, LifeBuoy, Lock, Mail, Menu, MonitorCog, Network, RefreshCw, Settings, Share2,
  Shrink, Tag, Terminal, Type, ZoomIn, ZoomOut
} from 'lucide-react';
import { Button } from '@invana/ui';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ProductName } from '@/constants';
import { CanvasGraph } from '@invana/canvas-graph';
import AppHeaderRight from '@/ui/header/app-header-right';
import { QueryForm } from '@/ui/forms/query-form';
import { PanelContent } from '@invana/ui/components/theme/panel-content';
import { ActivityHistoryView } from '@/ui/components/activity-history';
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
import { ExtensionCategory, Graph, IPointerEvent, register } from '@antv/g6';
import {
  EdgeTooltipBehavior, NodeTooltipBehavior,
  PropertyViewerBehavior
} from '@invana/canvas-graph/plugins/behaviours';
import { NodeContextMenuBehavior } from '@invana/canvas-graph/plugins/behaviours/context-menus/node';
import { EdgeContextMenuBehavior } from '@invana/canvas-graph/plugins/behaviours/context-menus/edge';
import { CanvasContextMenuBehavior } from '@invana/canvas-graph/plugins/behaviours/context-menus/canvas';
import { GraphInformation } from '@/ui/components/graph-information';
import { LeftNavItem } from '@invana/ui/components/theme/left-nav-items';
import { projectsListDataSet } from '@/projectsList';
import { ProjectSwitcher } from '@/ui/components/projects-switcher';
import { useParams } from 'react-router-dom';
import { ICanvasEdge, ICanvasNode, mergeDeep } from '@invana/data-store';
import { Project } from '@/store/projectStore';
import { useMemo } from 'react';
import { CanvasGraphEdge, CanvasGraphNode, CanvasGraphOptions } from '@invana/canvas-graph/types';
import { CanvasManager } from '@invana/canvas-graph/canvas/manager';
import { DEFAULT_STYLE_OPTIONS, MODEL_STYLE_OPTIONS } from '@invana/canvas-graph/styling/defaults';
import WorkspaceSwitcher from '@/ui/components/workspace-switcher';
import PropertyViewer from '@/ui/components/property-viewer';
import WelcomeView from '@/ui/components/welcome-view';


register(ExtensionCategory.BEHAVIOR, NODE_TOOLTIP_BEHAVIOR.type, NodeTooltipBehavior, true);
register(ExtensionCategory.BEHAVIOR, EDGE_TOOLTIP_BEHAVIOR.type, EdgeTooltipBehavior, true);
register(ExtensionCategory.BEHAVIOR, NODE_CONTEXT_MENU_BEHAVIOR.type, NodeContextMenuBehavior, true);
register(ExtensionCategory.BEHAVIOR, EDGE_CONTEXT_MENU_BEHAVIOR.type, EdgeContextMenuBehavior, true);
register(ExtensionCategory.BEHAVIOR, CANVAS_CONTEXT_MENU_BEHAVIOR.type, CanvasContextMenuBehavior, true);
register(ExtensionCategory.BEHAVIOR, PROPERTY_VIEWER_BEHAVIOR.type, PropertyViewerBehavior, true);



const ExplorerPage: React.FC = () => {
  const { graphId } = useParams();
  const [isReady, setIsReady] = useState(false);
  const canvasManagerRef = useRef<CanvasManager | null>(null);
  const modelCanvasManagerRef = useRef<CanvasManager | null>(null);
  const { theme, } = useThemeStore();

  const [propertyViewerData, setPropertyViewerData] = useState<ICanvasNode | ICanvasEdge | null>(null)
  const projectData: Project | undefined = projectsListDataSet.find((project) => project.id === graphId)
  const {
    rightContentName,
    setRightContentName,
    bottomContentName,
    toggleRightContent,
    toggleBottomContent,
  } = useDefaultV2LayoutStore()

  const createNodeContextMenuItems = (event: IPointerEvent): MenuItem[] => {
    const graph = canvasManagerRef.current?.getGraph() as Graph;
    const nodeId = ((event.target as unknown) as HTMLElement).id as string;
    const node = graph.getNodeData(nodeId) as (CanvasGraphNode);
    return [
      {
        id: 'files',
        label: 'Incomin custom',
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
  }

  const createEdgeContextMenuItems = (event: IPointerEvent): MenuItem[] => {
    const graph = canvasManagerRef.current?.getGraph() as Graph;
    const edgeId = ((event.target as unknown) as HTMLElement).id as string;
    const edge = graph.getEdgeData(edgeId) as (CanvasGraphEdge);
    return [
      {
        id: 'files',
        label: 'Incomin custom',
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
  }

  const createNodeContextMenuMainMenuItems = (event: IPointerEvent): MenuItem[] => {
    console.log("createNodeContextMenuMainMenuItems", event)

    const graph = canvasManagerRef.current?.getGraph() as Graph;
    const nodeId = ((event.target as unknown) as HTMLElement).id as string;
    return [
      {
        id: 'focus-node',
        label: 'Focus Node',
        className: 'rounded-none  active:bg-gray:500',
        icon: CircleDot,
        onClick: () => {
          graph.focusElement(nodeId)
        }
      },
      {
        id: 'Start a query',
        label: 'Start a query',
        icon: Terminal,
        onClick: () => {
          // alert("Start a query")
          setRightContentName('query')
        }
      },
      {
        id: 'Tag this Node',
        label: 'Tag this Node',
        icon: Tag,
        onClick: () => {
          alert("Tag this Node")
        },
      },
      {
        id: 'Lock this Node',
        label: 'Lock this Node',
        icon: Lock,
        onClick: () => {
          alert("Lock this Node")
        },
      },
      {
        id: 'Hide Node',
        label: 'Hide this Node',
        icon: EyeOff,
        onClick: () => {
          alert("Hide this Node")
        },
      }
    ]
  }

  const getRightContentName = useCallback(() => {
    console.log("===getRightContentName", rightContentName)
    return rightContentName;
  }, [rightContentName]);


  const defaultOptions: CanvasGraphOptions = {
    behaviors: [
      DRAG_CANVAS_BEHAVIOR,
      ZOOM_CANVAS_BEHAVIOR,
      DRAG_ELEMENT_BEHAVIOR,
      HOVER_ACTIVATE_BEHAVIOR,
      CLICK_SELECT_BEHAVIOR,
      LASSO_SELECT_BEHAVIOR,
      {
        ...NODE_TOOLTIP_BEHAVIOR,
        showRightClickHelpText: true,

      },
      {
        ...EDGE_TOOLTIP_BEHAVIOR,
        showRightClickHelpText: true,

      },
      {
        ...NODE_CONTEXT_MENU_BEHAVIOR,
        createMainMenuItemsFn: createNodeContextMenuMainMenuItems,
        createMenuItemsFn: createNodeContextMenuItems,

      },
      {
        ...EDGE_CONTEXT_MENU_BEHAVIOR,
        createMenuItemsFn: createEdgeContextMenuItems,
      },
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
      },
      {
        ...PROPERTY_VIEWER_BEHAVIOR,
        // className: 'top-[44px] right-[0px] w-[320px] h-[calc(100vh-72px)]',
        onNodeHover: (event: IPointerEvent, data: ICanvasNode) => {
          console.log("=====onNodeHover.newData", getRightContentName(), data)
          console.log("=====onNodeHover.existing data", propertyViewerData)

          if (getRightContentName() !== "property-viewer") {
            return
          }
          setPropertyViewerData(data)
        },
        onNodeClick: (event: IPointerEvent, data: ICanvasNode) => {
          console.log("=====onNodeClick", rightContentName, data)
          setRightContentName('property-viewer');
          setPropertyViewerData(data)
        },

        onClose: () => {
          // if (rightContentName === 'property-viewer') {
          setRightContentName(undefined)
          // }
          // if (propertyViewerData) {
          setPropertyViewerData(null)
          // }
        },
        onEdgeHover: (event: IPointerEvent, data: ICanvasEdge) => {
          console.log("=====onEdgeHover", getRightContentName(), data)
          if (getRightContentName() !== "property-viewer") {
            return
          }
          setPropertyViewerData(data)
        },
        onEdgeClick: (event: IPointerEvent, data: ICanvasEdge) => {
          setRightContentName('property-viewer');
          setPropertyViewerData(data)
        },
        // onEdgeClose: () => {
        //   if (rightContentName === 'property-viewer') {
        //     setRightContentName(undefined)
        //   }
        //   if (propertyViewerData) {
        //     setPropertyViewerData(null)
        //   }
        // }
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

  const graphModelOptions: CanvasGraphOptions = {
    behaviors: [
      DRAG_CANVAS_BEHAVIOR,
      ZOOM_CANVAS_BEHAVIOR,
      DRAG_ELEMENT_BEHAVIOR,
      HOVER_ACTIVATE_BEHAVIOR,
      // CLICK_SELECT_BEHAVIOR,
      // LASSO_SELECT_BEHAVIOR,
      NODE_TOOLTIP_BEHAVIOR,
      EDGE_TOOLTIP_BEHAVIOR,
      // NODE_CONTEXT_MENU_BEHAVIOR,
      // EDGE_CONTEXT_MENU_BEHAVIOR,
      CANVAS_CONTEXT_MENU_BEHAVIOR,
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
    layout: {
      link: {
        distance: 200,
        // strength: 2
      },
      ...D3_FORCE_LAYOUT
    },
    styles: MODEL_STYLE_OPTIONS
  };


  const rightTopNavItems: LeftNavItem[] = [
    {
      icon: Box,
      name: "Graph Information",
      className: "py-3 my-2 px-3 rounded-none",
      iconClassName: "w-4 h-4",
      activeClass: "bg-gray-800",
      tooltipSide: "right",
      onClick: () => {
        return toggleRightContent("graph-info")
      },
    },
    {
      icon: Network,
      name: "Graph Model",
      className: "py-3 my-2 px-3 rounded-none",
      iconClassName: "w-4 h-4",
      activeClass: "bg-gray-800",

      tooltipSide: "right",
      onClick: () => {
        return toggleRightContent("graph-model")
      },
    },
    {
      name: "Query",
      className: "py-3 my-2 px-3 rounded-none",
      iconClassName: "w-4 h-4",
      activeClass: "bg-gray-800",

      tooltipSide: "right",
      onClick: () => {
        return toggleRightContent("query")
      },
      icon: Terminal
    },
    {
      icon: Book,
      name: "Documentation",
      className: "py-3 my-2 px-3 rounded-none",
      iconClassName: "w-4 h-4",
      activeClass: "bg-gray-800",

      tooltipSide: "right",
      onClick: () => {
        console.log("Clicked:", "Documentation")
      }
    },
    // { name: "Modeller", key: 'modeller', href: "/modeller", icon: Network },
    // { name: "Data Management", href: "/connections", icon: Database },
    {
      name: "Activity History",
      className: "py-3 my-2 px-3 rounded-none",
      iconClassName: "w-4 h-4",
      activeClass: "bg-gray-800",

      tooltipSide: "right",
      onClick: () => {
        return toggleRightContent("activity-history")
      },
      icon: Activity
    },
    {
      name: "Display Settings",
      className: "py-3 my-2 px-3 rounded-none",
      iconClassName: "w-4 h-4",
      activeClass: "bg-gray-800",

      href: "#",
      tooltipSide: "right",
      icon: MonitorCog
    },
    {
      icon: Circle,
      name: "Node Detail",
      className: "py-3 my-2 px-3 rounded-none",
      iconClassName: "w-4 h-4",
      activeClass: "bg-gray-800",

      tooltipSide: "right",
      onClick: () => toggleRightContent("property-viewer")
    },
    {
      icon: Circle,
      name: "Insights",
      className: "py-3 my-2 px-3 rounded-none",
      iconClassName: "w-4 h-4",
      activeClass: "bg-gray-800",

      tooltipSide: "right",
      onClick: () => toggleRightContent("insight-viewer")
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

  const leftBottomNavItems: LeftNavItem[] = [

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


  ]
  useEffect(() => {
    // console.log("theme updated====== ", theme, canvasManagerRef.current, isReady)
    if (canvasManagerRef.current && isReady) {
      // console.log("getUpdatedStylingOptions, theme", theme)
      canvasManagerRef.current.setTheme(theme)
    }
  }, [theme, isReady]);
  const getSchemaGraphData = useMemo(() => {
    return () => canvasManagerRef.current?.getModelAsGraphData();
  }, []);

  // useEffect(() => {
  //   setRightContentName("graph-info")
  // }, [])

  useEffect(() => {
    console.log("rightContentName", rightContentName)
    if (rightContentName === undefined) {
      // setRightContentSize(0)
      canvasManagerRef.current?.getGraph().resize()
      canvasManagerRef.current?.getGraph().fitView()

      modelCanvasManagerRef.current?.getGraph().resize()
      modelCanvasManagerRef.current?.getGraph().fitView()

      // canvasManagerRef.current?.render()
    } else {
      console.log("====")
    }
  }, [rightContentName])


  useEffect(() => {
    console.log("propertyViewerData", propertyViewerData)
    if (propertyViewerData && rightContentName !== "property-viewer") {
      setRightContentName('property-viewer')
    }
  }, [propertyViewerData, setRightContentName, rightContentName])

  // const modeGraphRef = useRef<typeof CanvasGraph | null>(null)
  // const canvasGraphRef = useRef<typeof CanvasGraph | null>(null)

  const projectDataOptions = useMemo(() => mergeDeep(defaultOptions, projectData?.options || {}), [projectData?.options])

  console.log("====propertyViewerData", rightContentName, propertyViewerData,)
  console.log("===projectDataOptions", projectDataOptions)

  return <DefaultV2Layout
    headerProps={{
      left: (
        <>
          <span className='ml-3'><Menu className='w-5 h-5' /></span>
          <span className='font-bold mr-2 ml-2'>{ProductName}</span>
          <span className='mr-2'>|</span>
          {/* <span>Explorer</span> */}
          <WorkspaceSwitcher />
          <ProjectSwitcher />
        </>
      ),
      center: (
        <>
          {/* {isReady && canvasManagerRef.current ? <CanvasToolBar getCanvasManager={() => canvasManagerRef.current!} /> : null} */}

          {/* <ProjectSwitcher /> */}
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
                canvasManager={canvasManagerRef.current}
                project={projectData}
              />}
          </PanelContent>
        }
        {rightContentName === "graph-model" &&
          <PanelContent title={"Graph Model"} key={'model-panel'} onClose={() => setRightContentName(undefined)} showClose>
            <CanvasGraph
              // ref={modeGraphRef}
              graphName={'model'}
              containerStyle={{ width: "100%", height: "calc(100vh - 70px)" }}
              className={"bg-background"}
              // showHeader={false}
              initData={getSchemaGraphData()}
              onReady={(canvasManager: CanvasManager) => {
                console.log("CanvasGraph.onReady", canvasManager)
                modelCanvasManagerRef.current = canvasManager;
              }}
              options={graphModelOptions}
            />
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
        {rightContentName === "property-viewer" && typeof propertyViewerData === 'object' &&
          <PanelContent title={"Property Viewer"} key={'property-viewer'} onClose={() => {
            setRightContentName(undefined)
            setPropertyViewerData(null)
          }} showClose>
            <PropertyViewer data={propertyViewerData as ICanvasNode} />
          </PanelContent>
        }
        {/* {rightContentName === "property-viewer" && propertyViewerData && typeof propertyViewerData === 'object' &&
          <PanelContent title={"Node details"} key={'node-details'} onClose={() => setRightContentName(undefined)} showClose>
            <PropertyViewer data={propertyViewerData} />
          </PanelContent>
        } */}
        {/* {rightContentName === "insight-viewer" &&
          <PanelContent title={"Insight viewer"} key={'insight-viewer'} onClose={() => setRightContentName(undefined)} showClose>
            <PropertyViewer />
          </PanelContent>
        } */}

      </div>
    }
    mainTopContent={
      <div className="flex h-full items-center justify-center ">
        {
          projectData ?
            <CanvasGraph
              // ref={canvasGraphRef}
              graphName={'graphData'}
              containerStyle={{ width: "100%", height: "100%" }}
              className={"bg-background"}
              initData={projectData?.data}
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
              options={projectDataOptions}
            />
            : <WelcomeView />
        }
      </div >
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