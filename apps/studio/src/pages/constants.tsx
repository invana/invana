import { LeftNavItem } from "@invana/ui";
import { Activity, CircleHelp, Compass, MonitorCog, Network, Package } from "lucide-react";


export const LogoComponent = <Package className="h-5 w-5 text-foreground" />

export const topNavItems: LeftNavItem[] = [
  // { name: "Home", href: "/home", icon: Home },
  { name: "Explorer", href: "/explorer", icon: Compass },
  { name: "Modeller", href: "/modeller", icon: Network },
  // { name: "Data Management", href: "/connections", icon: Database },
  { name: "Activity History", href: "#", icon: Activity },
  { name: "Display Settings", href: "#", icon: MonitorCog },
]

export const bottomNavItems: LeftNavItem[] = [
  // { name: "Activity", href: "/activity", icon: Activity },
  { name: "Invana", href: "https://invana.ai", icon: CircleHelp },
]
