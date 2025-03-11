import { memo } from "react";
import { Node, NodeProps } from "@xyflow/react";
import { BaseNodeTemplate } from "../../components/BaseNodeTemplate";
import React from 'react';


export type LabeledGroupNode = Node<{
  label: string;
}>;


const LabeledGroupNode: React.FC<NodeProps<LabeledGroupNode>> = ({ id, data, selected = false, ...props }) => {
  console.log("LabeledGroupNode", id, data, selected, props.width);
  return (
    <BaseNodeTemplate id={id} selected={selected}
      // ${props.width ? `w-[${props.width}px]` : ''}
      className={`bg-white !text-left !bg-opacity-50 h-full rounded-sm overflow-hidden p-0 `}>
      {data.label && (
        <div className="bg-neutral-600 border-r border-b border-neutral-700 w-fit p-2 text-xs rounded-br-sm text-card-foreground">
          {data.label}
        </div>
      )}
    </BaseNodeTemplate>
  );
}


export default memo(LabeledGroupNode); 