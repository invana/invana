import * as React from 'react'
import { ChevronRight, LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'


export interface MenuItem {
  id: string
  label: string
  icon?: React.ElementType | LucideIcon
  shortcut?: string
  className?: string
  href?: string
  onClick?: () => void
  children?: MenuItem[]
}

export interface MenuItemProps extends MenuItem {
  level?: number
}
export const MenuItem: React.FC<MenuItemProps> = ({
  label,
  icon: Icon,
  shortcut,
  children,
  className,
  level = 0,
  href,
  onClick
}) => {
  const hasChildren = children && children.length > 0
  const ButtonOrLink = href ? 'a' : 'button'

  const clickTrigger = href ? { href: href } : { onClick: onClick }

  return (
    <li className="relative group/item">
      <ButtonOrLink
        // href={href}
        // onClick={onClick}
        {...clickTrigger}
        className={cn(
          "flex w-full items-center justify-between  px-4 py-2 text-sm",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none",
          className,
          level === 0 ? "font-medium" : "font-normal",
          // "group-hover/item:bg-accent/50"
        )}
        role={hasChildren ? 'menuitem' : undefined}
        aria-haspopup={hasChildren ? 'true' : undefined}
        aria-expanded={hasChildren ? 'true' : undefined}
      >
        <span className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4" />}
          <span>{label}</span>
        </span>
        <span className="flex items-center gap-2">
          {shortcut && (
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              {shortcut}
            </kbd>
          )}
          {hasChildren && (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
      </ButtonOrLink>
      {hasChildren && (
        <ul
          className={cn(
            "absolute min-w-[240px] border p-1  bg-card text-card-foreground  shadow-md",
            "invisible opacity-0 translate-x-2",
            "group-hover/item:visible group-hover/item:opacity-100 group-hover/item:translate-x-0",
            "transition-all duration-150 ease-in-out",
            level === 0 ? "left-full top-0" : "left-full top-0",
          )}
          style={{
            zIndex: 50 + level
          }}
          role="menu"
        >
          {children.map((item) => (
            <MenuItem key={item.id} {...item} level={level + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

