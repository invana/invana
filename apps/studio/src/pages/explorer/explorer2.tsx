
import { LeftNavItem } from '@invana/ui';
import { DefaultNewLayout } from '@invana/ui/themes/default-new/default-new';
import { usePanelStore } from '@invana/ui/themes/default-new/store';
import { Activity, Book, Compass, Home, MonitorCog, Network, SearchIcon, Terminal } from 'lucide-react';
import { Button } from '@invana/ui';
import { useState, useRef } from 'react';
import { Graph } from '@antv/g6';



const ExplorerPage: React.FC = () => {



  const [isReady, setIsReady] = useState(false);
  const containerRef = useRef<{ getGraph: () => Graph } | null>(null);
  const graphManagerRef = useRef(null);


  const {
    leftContentName,
    rightContentName,
    bottomContentName,
    toggleLeftContent,
    toggleBottomContent,
  } = usePanelStore()



  const topNavItems: LeftNavItem[] = [
    {
      icon: SearchIcon,
      name: "Search",
      key: "query",
      onClick: () => {
        return toggleLeftContent("search")
      },
    },
    {
      name: "Query",
      key: "query",
      onClick: () => {
        return toggleLeftContent("search")
      },
      icon: Terminal
    },
    {
      icon: Book,
      key: "documentation",
      name: "documentation",
      onClick: () => {
        console.log("Clicked:", "Documentation")
      }
    },
    { name: "Modeller", key: 'modeller', href: "/modeller", icon: Network },
    // { name: "Data Management", href: "/connections", icon: Database },
    { name: "Activity History", key: 'activity-history', href: "#", icon: Activity },
    { name: "Display Settings", key: 'display-settings', href: "#", icon: MonitorCog },

  ]



  return <DefaultNewLayout
    headerProps={{
      left: (
        <>
          <Home size={24} />
          <span>Dashboard</span>
        </>
      ),
      center: (
        <>
          <span className='font-bold mr-2'>Hello World</span>
          <span className='mr-2'>|</span>
          <span>Explorer</span>
        </>
      ),
      right: (
        <>
          <Button variant="ghost">Help</Button>
        </>
      )
    }}

    leftNavProps={{
      topNavItems: topNavItems,
    }}




  />


}

export default ExplorerPage;