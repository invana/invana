import React from 'react'
import { MenuItem, MenuItemProps } from './menu-item'
import { cn } from "../../lib/utils"

export interface NestedMenuProps {
  menuItems: MenuItemProps[];
  className?: string;
}

export const NestedMenu: React.FC<NestedMenuProps> = (props) => {
  console.log("NestedMenu props", props)
  return (
    <nav
      className={cn("w-[240px] p-0 pt-2 pb-2 border rounded-md  bg-card text-card-foreground shadow-sm", props.className)}
      role="menubar"
    >
      <ul className="space-y-0.5" role="menu">
        {props.menuItems.map((item) => (
          <MenuItem key={item.id} {...item} />
        ))}
      </ul>
    </nav>
  )
}

