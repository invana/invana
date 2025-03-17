import React, { memo } from "react";
import { Handle, NodeProps, Position, useStoreApi } from "@xyflow/react";
import { BaseNodeTemplate } from "../../components/BaseNodeTemplate";
import { ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { SearchInput } from "@invana/ui";
import { highlightHandlePathByNodeHandleId, resetHandlePathHighlight } from "@invana/canvas-reactflow/interactions/EntityRelationHighlight";
import { generateFieldName } from "@invana/canvas-reactflow/app";


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


function DataTreeNodeItem({ item, nodeId,
  onFieldClick,
  onFieldMouseOut,
  onFieldMouseOver

}: {
  item: DataTreeNodeItem, nodeId: string,
  onFieldClick: (e: React.MouseEvent) => void,
  onFieldMouseOut: (e: React.MouseEvent) => void,
  onFieldMouseOver: (e: React.MouseEvent) => void,
}) {
  const [isExpanded, setIsExpanded] = React.useState(item.isExpanded ?? true)
  const hasChildren = item.children && item.children.length > 0

  return (
    <div >
      <button
        onMouseOver={onFieldMouseOver}
        onMouseOut={onFieldMouseOut}
        id={generateFieldName(nodeId, item.id)}
        data-node-id={nodeId}
        data-handle-id={item.id}
        key={"i-" + item.label}

        onClick={(e: React.MouseEvent) => {
          if (hasChildren) { setIsExpanded(!isExpanded); }
          item.onClick?.(item.id, item.label);
          onFieldClick(e)
        }}

        className={cn(
          "flex items-center gap-2 w-full rounded-sm px-2 py-2 relative hover:bg-accent hover:text-accent-foreground",
          hasChildren && "cursor-pointer font-medium",
          "nodeField io"
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
        <Handle type="source" className="bg-neutral-600 rounded-[2px] w-[1px] h-[1px]" position={Position.Right} id={item.id} />
        <Handle type="target" className="bg-neutral-600 rounded-[2px] w-[1px] h-[1px]" position={Position.Left} id={item.id} />

      </button>
      {hasChildren && isExpanded && (
        <div className="ml-4 pl-4 relative">
          <div className="absolute left-0 top-0 bottom-0 border-l border-muted-foreground/25" />
          {item.children?.map((child, index) => (
            <div key={child.id} className="relative">
              <div className="absolute -left-4 top-[15px] w-4 border-t border-muted-foreground/25 mt-[0.5px]" />
              <DataTreeNodeItem key={index} nodeId={nodeId} item={child}
                onFieldClick={onFieldClick}
                onFieldMouseOut={onFieldMouseOut}
                onFieldMouseOver={onFieldMouseOver}
              />
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

  const store = useStoreApi();
  const { edges, nodes, setNodes, setEdges } = store.getState();
  // const nodes = getNodes();

  const onFieldMouseOver = (e: React.MouseEvent) => {
    console.log("===onFieldMouseOver", e)
    const el = e.currentTarget;
    const nodeId: string = el.getAttribute("data-node-id") || "";
    const handleId: string | null = el.getAttribute("data-handle-id");
    console.log("onFieldMouseOver", nodeId, handleId)
    highlightHandlePathByNodeHandleId(nodeId, handleId, nodes, edges, setNodes, setEdges);
    // https://github.com/wbkd/react-flow/issues/2418
  };

  const onFieldMouseOut = (e: React.MouseEvent) => {
    console.log("===onFieldMouseOut", e);
    resetHandlePathHighlight(nodes, edges, setNodes, setEdges);
  };

  const onFieldClick = (e: React.MouseEvent) => {
    console.log("===onFieldClick", e);
    onFieldMouseOver(e);
  };


  return (
    <BaseNodeTemplate id={id} selected={selected} className="w-[260px] p-0">
      <div
        className="cursor-pointer relative rounded-t-sm border-b py-2 px-3 bg-background mb-3"
      >
        <Handle type="source" className="absolute top-5 rounded-[2px] z-[1000]"
          position={Position.Right} id={id} />
        <Handle type="target" className="absolute top-5 rounded-[2px] z-[1000]"
          position={Position.Left} id={id} />

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
          <DataTreeNodeItem
            key={item.id}
            nodeId={id}
            item={item}
            onFieldClick={onFieldClick}
            onFieldMouseOut={onFieldMouseOut}
            onFieldMouseOver={onFieldMouseOver}
          />
        ))}
      </div>
      {/* <DataTreeNodeItem label={data.label} children={data.children} /> */}

    </BaseNodeTemplate >
  );
};

export default memo(DataTreeNode);
