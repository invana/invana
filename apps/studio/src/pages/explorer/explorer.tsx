import React, { useRef, useState } from 'react';
import { LogoComponent, sideBarBottomNavitems } from '../constants';
import { ProductCopyRightInfo, ProductName } from '@/constants';
import {
  BlankLayout,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  SideBarNavitemProps
} from '@invana/ui';
import { ReactFlowProvider } from '@invana/canvas-flow';
import { AppHeader, AppFooter, AppMain } from '@invana/ui/themes/app'
// import useTheme from '@invana/ui/hooks/useTheme';
import AppHeaderRight from '@/ui/header/app-header-right';
import { CanvasGraph, CanvasToolBar, defaultOptions } from '@invana/canvas-graph';
import { flightData } from '@invana/example-datasets'
import { Activity, Compass, MonitorCog, Network, Search, SearchIcon } from 'lucide-react'
import { Graph } from '@antv/g6';
import { QueryForm } from '@/ui/forms/query-form';
import useLayout from '@/hooks/useLayout'


const ExplorerPage: React.FC = () => {

  // const { theme } = useTheme();
  // const [data, setData] = React.useState({ nodes: [], edges: [] });
  // const [graphManager, setGraphManager] = React.useState<GraphManager | null>(null);
  // const initGraphManager = React.useCallback((manager: GraphManager) => {
  //   setGraphManager(manager);
  // }, []);




  const { leftSidebar, setLeftSidebar, rightSidebar, setRightSidebar } = useLayout()


  const [isReady, setIsReady] = useState(false);
  const containerRef = useRef<{ getGraph: () => Graph } | null>(null);
  const graphManagerRef = useRef(null);



  const sideBarTopNavitems: SideBarNavitemProps[] = [
    { name: "SearchIcon", onClick: () => setLeftSidebar("search"), icon: SearchIcon },
    { name: "Query", href: "/explorer", icon: Compass },
    { name: "Modeller", href: "/modeller", icon: Network },
    // { name: "Data Management", href: "/connections", icon: Database },
    { name: "Activity History", href: "#", icon: Activity },
    { name: "Display Settings", href: "#", icon: MonitorCog },
  ]



  // useEffect(() => {
  //   // Initialize graphManager here and set it to graphManagerRef.current
  //   // Example:
  //   // graphManagerRef.current = new GraphManager();
  //   setIsReady(true);
  // }, []);



  // const graphManager = new GraphManager(null);

  // const [graph, setGraph] = React.useState<Graph>(null);

  // React.useEffect(() => {
  //   runQuery()
  // }, []);

  // const runQuery = () => {
  //   const randInt = Math.floor(Math.random() * 10) + 1;

  //   fetchGraphQLData(`g.V().limit(${randInt}).toList()`).then(d => {
  //     const response = serializeToGraph(d.data);
  //     console.log("response", response);
  //     setData(response);
  //   });

  // }

  // console.log("===data2", data)


  const options = { ...defaultOptions }

  console.log("ExplorerPage leftSidebar", leftSidebar, leftSidebar ? 25 : 0)
  return (
    <BlankLayout
      logo={LogoComponent}
      sideBarTopNavitems={sideBarTopNavitems}
      sideBarBottomNavitems={sideBarBottomNavitems}
    >
      <ReactFlowProvider fitView>
        <AppHeader
          left={
            <>
              {/* <Compass className='h-4 w-4' /> */}
              <span className='font-bold mr-2'>{ProductName}</span>
              <span className='mr-2'>|</span>
              <span>Explorer</span>
            </>
          }
          center={
            <>
              {isReady && containerRef.current && <CanvasToolBar getGraph={containerRef.current.getGraph} />}
            </>
          }
          right={
            <>
              <AppHeaderRight />
            </>
          }
        >
        </AppHeader>
        <AppMain>
          <ResizablePanelGroup
            direction="horizontal"
            className="  w-full "
          >
            <ResizablePanel
              minSize={leftSidebar ? 20 : 0.5}
              defaultSize={leftSidebar ? 20 : 0.5}
              key={leftSidebar ? "open" : "closed"} // Add key to force re-render
              style={{
                transition: 'flex-basis 0.2s ease-in-out'
              }}
              onResize={(e) => {
                console.log("onResize", e)
              }}
              collapsible={true}
              maxSize={30}
            >
              {leftSidebar == 'search' && <QueryForm />}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={75}>
              {/* <div className="flex h-full items-center justify-center"> */}

              <CanvasGraph
                ref={containerRef}
                style={{ width: "100%", height: "100%" }}
                // className={"h-full"}
                //@ts-ignore
                graphManager={graphManagerRef.current}
                initialData={flightData}
                onReady={() => {
                  console.log("onReady")
                  setIsReady(true)
                }}
                options={options}
              />
              {/* </div> */}
            </ResizablePanel>
          </ResizablePanelGroup>
        </AppMain>

        <AppFooter
          right={ProductCopyRightInfo}
        >

        </AppFooter>
      </ReactFlowProvider>
    </BlankLayout >
  );
};

export default ExplorerPage;