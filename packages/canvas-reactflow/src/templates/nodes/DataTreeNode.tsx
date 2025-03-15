import React, { memo } from "react";
import { Handle, NodeProps, Position } from "@xyflow/react";
import { BaseNodeTemplate } from "../../components/BaseNodeTemplate";
import { ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { SearchInput } from "@invana/ui";


export type DataTreeNodeItem = {
  id: string
  label: string
  icon?: React.ReactNode
  children?: DataTreeNodeItem[]
  onClick?: (id: string | number, label: string) => void
  isExpanded?: boolean

}

export type DataTreeNodeProps = NodeProps & {
  data: {
    id?: string
    headerTitle: React.ReactNode
    icon?: React.ReactNode
    headerDescription?: React.ReactNode
    children: DataTreeNodeItem[]
    searchable?: boolean
  }
}


function DataTreeNodeItem({ item }: { item: DataTreeNodeItem }) {
  const [isExpanded, setIsExpanded] = React.useState(item.isExpanded ?? true)
  const hasChildren = item.children && item.children.length > 0

  return (
    <div >
      <button
        onClick={() => {
          if (hasChildren) { setIsExpanded(!isExpanded); }
          item.onClick?.(item.id, item.label);
        }}
        className={cn(
          "flex items-center gap-2 w-full rounded-sm px-2 py-2 relative hover:bg-accent hover:text-accent-foreground",
          hasChildren && "cursor-pointer font-medium"
        )}
      >
        {hasChildren && (
          <ChevronRight
            className={cn("h-4 w-4 shrink-0 transition-transform",
              isExpanded && "rotate-90"
            )}
          />
        )}
        {item.icon}
        <span className="truncate">{item.label}</span>
        <Handle type="source" className="bg-neutral-600 border-neutral-600 rounded-[2px] w-[1px] h-[1px]" position={Position.Right} id={item.id} />
        <Handle type="target" className="bg-neutral-600 rounded-[2px] w-[1px] h-[1px]" position={Position.Left} id={item.id} />

      </button>
      {hasChildren && isExpanded && (
        <div className="ml-4 pl-4 relative">
          <div className="absolute left-0 top-0 bottom-0 border-l border-muted-foreground/25" />
          {item.children?.map((child, index) => (
            <div key={child.id} className="relative">
              <div className="absolute -left-4 top-[15px] w-4 border-t border-muted-foreground/25 mt-[0.5px]" />
              <DataTreeNodeItem key={index} item={child} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


const DataTreeNode = ({ id, data, selected = false, ...props }: DataTreeNodeProps) => {
  console.log("DataTreeNode", data, props);
  const [searchQuery, setSearchQuery] = React.useState<string>('');

  const filterItems = (items: DataTreeNodeItem[], query: string): DataTreeNodeItem[] => {
    if (!query) return items;
    return items
      .map(item => ({
        ...item,
        children: item.children ? filterItems(item.children, query) : [],
      }))
      .filter(item => item.label.toLowerCase().includes(query.toLowerCase()) || (item.children && item.children.length > 0));
  };

  const filteredItems = filterItems(data.children || [], searchQuery);


  return (
    <BaseNodeTemplate id={id} selected={selected} className="w-[260px] p-0">
      <div
        className="cursor-pointer relative rounded-t-sm nodeField border-b py-2 px-3
         bg-background mb-3">
        <Handle type="source" className="absolute top-5 rounded-[2px] z-[1000]" position={Position.Right} id={id} />
        <Handle type="target" className="absolute top-5 rounded-[2px] z-[1000]" position={Position.Left} id={id} />

        <div className="flex">

          <span className="flex items-center gap-2 text-[16px]">
            {data.icon &&
              <span>
                {data.icon}
              </span>
            }
            {data.headerTitle}
          </span>
        </div>
        {data.headerDescription && <p className="text-xs text-gray-500">{data.headerDescription}</p>}
      </div>

      <div className={"mx-2 my-2"} >
        {data.searchable &&
          <SearchInput value={searchQuery} onChange={setSearchQuery} className={""} />
        }
      </div>

      <div className="space-y-0.5 mb-3">

        {filteredItems.map((item) => (
          <DataTreeNodeItem key={item.id} item={item} />
        ))}
      </div>
      {/* <DataTreeNodeItem label={data.label} children={data.children} /> */}

    </BaseNodeTemplate >
  );
};

export default memo(DataTreeNode);
