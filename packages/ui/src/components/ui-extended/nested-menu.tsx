import React from 'react'
import { MenuItem, MenuItemProps } from './menu-item'
import { cn } from "../../lib/utils"

export interface NestedMenuProps {
  menuItems: MenuItemProps[];
  className?: string;
}

export const NestedMenu: React.FC<NestedMenuProps> = (props) => {
  return (
    <nav
      className={cn("w-[220px] !py-0 border  bg-card text-card-foreground shadow-sm", props.className)}
      role="menubar"
    >
      <ul className="space-y-0.5 p-0" role="menu">
        {props.menuItems.map((item) => (
          <MenuItem key={item.id} {...item} className={'px-3 py-1.5'} />
        ))}
      </ul>
    </nav>
  )
}

