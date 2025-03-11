import React, { memo } from "react";
import { BaseNodeTemplate } from "../../components/BaseNodeTemplate";
import { Handle, Node, NodeProps, NodeResizer } from "@xyflow/react";
import { defaultFlowCanvasOptions } from "../../app/defaults";
import { computeHandlePositions } from "../../app/utils";


export type GenericNodeProps = Node<{
  label: string;
  align?: "left" | "center" | "right";
  icon: React.ReactNode
}>;


export const GenericNode = ({ id, data, selected = false, ...props }: NodeProps<GenericNodeProps>) => {
  console.log("GenericNode", id, data, selected, props);
  const { sourcePosition, targetPosition } = computeHandlePositions(defaultFlowCanvasOptions.layoutDirection);
  const resizable = false;

  return (
    <BaseNodeTemplate id={id} selected={selected} className="min-w-[200px] text-center">
      <>
        {resizable && <NodeResizer minWidth={100} minHeight={30} />}
        {data.label}
        <Handle type="source" position={props.sourcePosition ?? sourcePosition} />
        <Handle type="target" position={props.targetPosition ?? targetPosition} />
      </>
    </BaseNodeTemplate>
  );
}

export default memo(GenericNode);