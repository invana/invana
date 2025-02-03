
import { LeftNavItem, useThemeStore } from '@invana/ui';
import { DefaultLayout } from '@invana/ui/themes/default/default';
import { useDefaultLayoutStore } from '@invana/ui/themes/default/store';
import { Activity, Compass, MonitorCog, Network, Terminal } from 'lucide-react';
import { Button } from '@invana/ui';
import { useState, useRef, useEffect } from 'react';
import { Graph } from '@antv/g6';
import { ProductName } from '@/constants';
import { CanvasGraph, CanvasToolBar, defaultOptions, GraphManager } from '@invana/canvas-graph';
import { flightData } from '@invana/example-datasets'
import AppHeaderRight from '@/ui/header/app-header-right';
import { QueryForm } from '@/ui/forms/query-form';
import { PanelContent } from '@invana/ui/components/theme/panel-content';
import { ActivityHistoryView } from '@/ui/components/activity-history';



const ExplorerPage: React.FC = () => {



  const [isReady, setIsReady] = useState(false);
  const containerRef = useRef<{
    getGraph: () => Graph
    getGraphManager: () => GraphManager
  } | null>(null);
  // const graphManagerRef = useRef(null);

  const { theme, } = useThemeStore()


  const {
    leftContentName,
    setLeftContentName,
    bottomContentName,
    toggleLeftContent,
    toggleBottomContent,
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

  if (options.behaviors) {
    options.behaviors = options.behaviors.filter(b => b !== 'property-viewer');

    options.behaviors.push({
      key: 'property-viewer',
      type: 'property-viewer',
      className: 'top-[44px] right-[0px] w-[320px] h-[calc(100vh-72px)]',
    });
  }


  // useEffect(() => {
  //   console.log("mainTopContentSize or leftContentSize updated ", mainTopContentSize, leftContentSize)
  //   const graph = containerRef.current?.getGraph();
  //   if (graph && isReady) {

  //     graph.resize();
  //     graph.layout();
  //     graph.render();
  //     graph.fitView();
  //   }
  // }, [mainTopContentSize, leftContentSize, isReady]);
  useEffect(() => {
    if (containerRef.current && isReady) {
      const graphManager = containerRef.current.getGraphManager();
      graphManager.styling.setTheme(theme)

      // graph.setTheme(theme); // Refresh the graph when theme changes
      // console.log("====graph", graph)
    }
  }, [theme, isReady]);

  return <DefaultLayout
    headerProps={{
      left: (
        <>
          <span className='ml-3'><Compass className='w-5 h-5' /></span>
          <span className='font-bold mr-2 ml-3'>{ProductName}</span>
          <span className='mr-2'>|</span>
          <span>Explorer</span>
        </>
      ),
      center: (
        <>
          {isReady && containerRef.current && <CanvasToolBar getGraph={containerRef.current.getGraph} />}
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
        ref={containerRef}
        style={{ width: "100%", height: "100%" }}
        className={"bg-background"}
        //@ts-expect-error
        // graphManager={graphManagerRef.current}
        initialData={flightData}
        onReady={() => {
          console.log("onReady")
          setIsReady(true)
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