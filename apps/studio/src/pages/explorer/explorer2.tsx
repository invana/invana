
import { LeftNavItem } from '@invana/ui';
import { DefaultNewLayout } from '@invana/ui/themes/default-new/default-new';
import { usePanelStore } from '@invana/ui/themes/default-new/store';
import { Activity, Book, Compass, Home, MonitorCog, Network, SearchIcon, Terminal } from 'lucide-react';
import { Button } from '@invana/ui';
import { useState, useRef } from 'react';
import { Graph } from '@antv/g6';
import { ProductCopyRightInfo, ProductName } from '@/constants';
import { CanvasGraph, CanvasToolBar, defaultOptions } from '@invana/canvas-graph';
import { flightData } from '@invana/example-datasets'
import AppHeaderRight from '@/ui/header/app-header-right';
import { QueryForm } from '@/ui/forms/query-form';
import { PanelContent } from '@invana/ui/components/theme/panel-content';
import { ActivityHistoryView } from '@/ui/components/activity-history';



const ExplorerPage: React.FC = () => {



  const [isReady, setIsReady] = useState(false);
  const containerRef = useRef<{ getGraph: () => Graph } | null>(null);
  const graphManagerRef = useRef(null);


  const {
    leftContentName,
    rightContentName,
    setLeftContentName,
    bottomContentName,
    toggleLeftContent,
    toggleBottomContent,
  } = usePanelStore()



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
        return setLeftContentName("activity-history")
      },
      icon: Activity
    },
    { name: "Display Settings", key: 'display-settings', href: "#", icon: MonitorCog },

  ]

  const options = { ...defaultOptions }


  return <DefaultNewLayout
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
      <div className="space-y-2 min-w-[300px]">
        {leftContentName === "query" &&
          <PanelContent title={"Query Console"} onClose={() => setLeftContentName(undefined)} showClose>
            <QueryForm />
          </PanelContent>
        }
        {leftContentName === "activity-history" &&
          <PanelContent title={"Activity History"} onClose={() => setLeftContentName(undefined)} showClose>
            <ActivityHistoryView />
          </PanelContent>
        }
      </div>
    }
    mainContent={
      <CanvasGraph
        ref={containerRef}
        style={{ width: "100%", height: "100%" }}
        className={"bg-background"}
        //@ts-expect-error
        graphManager={graphManagerRef.current}
        initialData={flightData}
        onReady={() => {
          console.log("onReady")
          setIsReady(true)
        }}
        options={options}
      />
    }
    rightContent={
      <></>
    }




  />


}

export default ExplorerPage;