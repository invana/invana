import React, { useRef, useState } from 'react';
import { LogoComponent, sideBarBottomNavitems, sideBarTopNavitems } from '../constants';
import { ProductCopyRightInfo, ProductName } from '@/constants';
import {
  BlankLayout,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '@invana/ui';
import { ReactFlowProvider } from '@invana/canvas-flow';
import { AppHeader, AppFooter, AppMain } from '@invana/ui/themes/app'
// import useTheme from '@invana/ui/hooks/useTheme';
import AppHeaderRight from '@/ui/header/app-header-right';
import { CanvasGraph, CanvasToolBar, defaultOptions } from '@invana/canvas-graph';
import { flightData } from '@invana/example-datasets'
import { SearchIcon } from 'lucide-react'
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

  const [showQueryModal, setShowQueryModal] = useState(false);

  if (!sideBarTopNavitems.some(item => item.name === "Search")) {
    sideBarTopNavitems.push({
      name: "Search", onClick: () => {
        console.log("Search clicked")
        setShowQueryModal(true)
      }, icon: SearchIcon
    });
  }

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

  console.log("=====showQueryModal", showQueryModal)
  const options = { ...defaultOptions }

  console.log("ExplorerPage")
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
          {/* {showQueryModal && <QueryForm />} */}
          <ResizablePanelGroup
            direction="horizontal"
            className="  w-full "
          >
            <ResizablePanel defaultSize={25} minSize={20} maxSize={30}>
              <QueryForm />
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