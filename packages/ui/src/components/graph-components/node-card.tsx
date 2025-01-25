

import { ICanvasNode } from '@invana/data-store';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@invana/ui';
import React from 'react';
import { ElementProperties } from './element-properties';
import { cn } from "../../lib/utils";



export interface NodeCardProps {
  node: ICanvasNode;
  extra?: React.ReactNode;
  className?: string;
  showProperties?: boolean;
}

export const NodeCard: React.FC<NodeCardProps> = ({ node, extra, className = 'w-[260px]', showProperties = false }) => {
  return (
    <Card className={cn(" shadow-lg", className)}>
      <CardHeader className=''>
        <CardTitle className='break-words text-xl'>{node?.label as string}</CardTitle>
        <CardDescription className='text-xs'>
          <div><strong>ID:</strong> {node?.id}</div>
          <div><strong>Label:</strong> {node?.type || 'N/A'}</div>
        </CardDescription>
      </CardHeader>
      <CardContent className='p-0'>
        {
          showProperties && <ElementProperties className={"pr-4 pl-4"} properties={node?.properties || {}} />
        }
        {extra && <div>{extra}</div>}
      </CardContent>

    </Card>
  );
};

