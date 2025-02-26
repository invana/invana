
import React from 'react';
import { ICanvasData } from '@invana/data-store';
import { cn } from '@invana/ui/lib/utils';
import { Circle, Minus } from 'lucide-react';
import { Badge } from '@invana/ui';
import { Project } from '@/store/projectStore';
import { CanvasManager } from '@invana/canvas-graph/canvas/manager';

export interface GraphInformationProps {
  className?: string
  canvasManager: CanvasManager
  project: Project;
}

export const GraphInformation: React.FC<GraphInformationProps> = (props) => {

  const schemaData: ICanvasData = props.canvasManager.getModelAsGraphData()
  return (
    <div className={cn("w-full flex flex-col", props.className)}>
      <h1 className='text-2xl mt-2'>{props.project.name}</h1>
      <p className='mt-2 text-zinc-500 dark:text-zinc-400'>
        Updated at {new Date(props.project.updated_at).toLocaleDateString()}
      </p>
      <p className='mt-2 mb-3'>{props.project.description}</p>

      <div>
        {props.project.tags.map((tag) => (
          <Badge variant="outline" className='mr-3'>{tag}</Badge>
        ))}
      </div>

      <div className="py-2 flex items-center justify-between pb-2 mt-5 border-b ">
        <div className="flex items-center">
          <h3 className="font-semibold text-xl  mb-1">Nodes</h3>
        </div>
        <div className="text-gray-500">0</div>
      </div>
      {schemaData?.nodes.map((node) => (
        <div key={node.id} className="py-2 flex items-center justify-between">
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
      {schemaData?.edges.map((edge) => (
        <div key={edge.id} className="py-2 flex items-center justify-between">
          <div className="flex items-center">
            <Minus className="w-4 h-4 mr-2" /> {edge.type}
          </div>
          <div className="text-gray-500">0</div>
        </div>
      ))}

    </div>
  );
};

