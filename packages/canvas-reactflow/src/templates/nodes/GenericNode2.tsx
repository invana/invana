import React, { memo } from "react";
import { BaseNodeTemplate } from "../../components/BaseNodeTemplate";
import { Handle, Node, NodeProps, NodeResizer } from "@xyflow/react";
import { defaultFlowCanvasOptions } from "../../app/defaults";
import { computeHandlePositions } from "../../app/utils";


export type GenericNode2Props = Node<{
  label: string;
  type: string;
  align?: "left" | "center" | "right";
  icon: React.ReactNode
}>;


export const GenericNode2 = ({ id, data, selected = false, ...props }: NodeProps<GenericNode2Props>) => {
  console.log("GenericNode2", id, data, selected, props);
  const { sourcePosition, targetPosition } = computeHandlePositions(defaultFlowCanvasOptions.layoutDirection);
  const resizable = false;

  return (
    <BaseNodeTemplate id={id} selected={selected} className="min-w-[200px] text-left">
      <>
        {resizable && <NodeResizer minWidth={100} minHeight={30} />}
        <div className="text-gray-500">{data.type}</div>
        <h3 className="text-2xl ">{data.label}</h3>
        <Handle type="source" position={props.sourcePosition ?? sourcePosition} />
        <Handle type="target" position={props.targetPosition ?? targetPosition} />
      </>
    </BaseNodeTemplate>
  );
}

export default memo(GenericNode2);