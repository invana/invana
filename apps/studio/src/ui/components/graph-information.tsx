
import React from 'react';
import { ICanvasData } from '@invana/data-store';
import { cn } from '@invana/ui/lib/utils';
import { Circle, Minus } from 'lucide-react';
import { Badge } from '@invana/ui';

export interface GraphInformationProps {
  className?: string
  schemaData: ICanvasData | undefined
}

export const GraphInformation: React.FC<GraphInformationProps> = (props) => {
  return (
    <div className={cn("w-full flex flex-col", props.className)}>
      <h1 className='text-2xl mt-2 font-semibold'>les miserables dataset</h1>
      <p className='mt-2 text-zinc-500 dark:text-zinc-400 text-sm'>Updated at Feb 11, 2025</p>
      <p className='mt-2 mb-3 text-sm'>Lorem Ipsum is simply dummy text of the printing and typesetting industry.
        Lorem Ipsum has been the industry's standard dummy text ever since the 1500s</p>

      <div>
        <Badge variant="outline" className='mr-3'>Data Science</Badge>
        <Badge variant="outline">dataset</Badge>

      </div>

      <div className="py-2 flex items-center justify-between pb-2 mt-5 border-b ">
        <div className="flex items-center">
          <h3 className="font-semibold text-xl  mb-1">Nodes</h3>
        </div>
        <div className="text-gray-500">0</div>
      </div>
      {props.schemaData?.nodes.map((node) => (
        <div key={node.id} className="py-2 text-sm flex items-center justify-between">
          <div className="flex items-center ">
            <Circle className="w-4 h-4 mr-2" /> {node.type}
          </div>
          <div className="text-gray-500">0</div>
        </div>
      ))}
      <div></div>

      <div className="py-2 flex items-center justify-between pb-2 mt-5 border-b ">
        <div className="flex items-center ">
          <h3 className="font-semibold text-xl  mb-1">Relationships</h3>
        </div>
        <div className="text-gray-500">0</div>
      </div>
      {props.schemaData?.edges.map((edge) => (
        <div key={edge.id} className="py-2 text-sm flex items-center justify-between">
          <div className="flex items-center">
            <Minus className="w-4 h-4 mr-2" /> {edge.type}
          </div>
          <div className="text-gray-500">0</div>
        </div>
      ))}

    </div>
  );
};

