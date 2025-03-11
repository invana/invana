import React, { memo } from "react";
import { Node, NodeProps } from "@xyflow/react";
import { BaseNodeTemplate } from "../../components/BaseNodeTemplate";
import RenderHTML from "../../components/RenderHTML";
import RenderIconOrImg from "../../components/RenderImageOrIcon";


export type CardNodeProps = Node<{
  label: string;
  icon?: string | React.ReactNode;
  body: string | React.ReactNode;
}>;


const CardNode: React.FC<NodeProps<CardNodeProps>> = ({ id, data, selected = false }: NodeProps<CardNodeProps>) => {
  console.log("CardNode", data)
  return (
    <BaseNodeTemplate
      selected={selected}
      id={id}
      className="min-w-[240px] text-card-foreground p-0"
    >
      {/* border-gray-600 dark:border-gray-300 */}
      <div className="flex items-center p-2 mb-2 border-b pb-2 border-b bg-neutral-900 rounded-t-md ">
        {data?.icon && <RenderIconOrImg icon={data.icon} />} <strong className="ml-1">{data.label}</strong>
      </div>
      <div className="p-2"><RenderHTML html={data.body} /></div>

    </BaseNodeTemplate>
  );
};

export default memo(CardNode);
