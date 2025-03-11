import React, { memo } from "react";
import { Handle, NodeProps, Position } from "@xyflow/react";
import { BaseNodeTemplate } from "../../components/BaseNodeTemplate";


export type DataField = {
  id: string
  label: string
  data_type: string
}

export type DataFieldsNodeProps = NodeProps & {
  data: {
    label: string
    labelIcon?: React.ReactNode
    fields: DataField[]
  }
}


const DataFieldsNode = ({ id, data, selected = false }: DataFieldsNodeProps) => {

  console.log("DataFieldsNode", data);
  const fields = data.fields || [];

  return (
    <BaseNodeTemplate id={id} selected={selected} className="min-w-[240px] p-0">
      <Handle type="source" className="absolute top-5" position={Position.Right} id={id} />
      <Handle type="target" className="absolute top-5" position={Position.Left} id={id} />

      <div className={"bg-zinc-900 rounded-t-sm border-b border-neutral-700 " +
        " p-2 text-sm font-bold"}>{data.label}
      </div>

      <div className="absolute top-10"></div>


      <div>
        {fields && fields.map((field: DataField, index: number) => (
          <div
            className={`p-1 pl-2 pr-2 nodeField relative ${index !== fields.length - 1 ? 'border-b border-neutral-700' : ''}`}
            // onMouseOver={onMouseOver}
            // onMouseOut={onMouseOut}
            // id={generateFieldName(id, field.id)}
            // onClick={handleClick}
            data-node-id={id}
            data-handle-id={field.id}
            key={"i-" + field.label}
          >
            <div className="flex justify-between text-gray-600 dark:text-gray-400 items-center">
              <div>{field.label}</div>
              <div className="text-xs">{field.data_type}</div>
            </div>
            {/* <Handle type="source" position={Position.Top} id={field.id}/>
                <Handle type="source" position={Position.Bottom} id={field.id}/> */}
            <Handle type="source" className="bg-neutral-600 border-neutral-800" position={Position.Right} id={field.id} />
            <Handle type="target" className="bg-neutral-600 border-neutral-800" position={Position.Left} id={field.id} />
          </div>
        ))}
      </div>
    </BaseNodeTemplate>
  );
};

export default memo(DataFieldsNode);
