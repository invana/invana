import React, { CSSProperties, memo } from "react";
import { Node, NodeProps } from "@xyflow/react";
import { BaseNodeTemplate } from "../../components/BaseNodeTemplate";
import RenderHTML from "../../components/RenderHTML";


export type AnnotationNode = Node<{
  label: string;
  level?: number;
  arrow?: React.ReactNode;
  arrowStyle?: CSSProperties;
}>;


const AnnotationNode = ({ id, data, selected = false }: NodeProps<AnnotationNode>) => {

  return (
    <BaseNodeTemplate
      selected={selected}
      id={id}
      className="max-w-[180px] !bg-transparent !border-none !shadow-none
                relative flex  items-start p-2 text-xs"
    >
      {typeof data.level === 'number' && (
        <div className="mr-1  text-xs">{data.level}.</div>
      )}
      {typeof data.level === 'number' && (
        <RenderHTML html={data.label} className="text-xs " />
      )}
      {data.arrowStyle && (
        <div
          className="absolute text-2xl"
          style={data.arrowStyle}
        >
          {data.arrow}
        </div>
      )}
    </BaseNodeTemplate>
  );
};

export default memo(AnnotationNode);
