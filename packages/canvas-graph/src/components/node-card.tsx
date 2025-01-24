

import { NodeData } from '@antv/g6';
import { ICanvasNode } from '@invana/data-store';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@invana/ui';
import React from 'react';


interface NodeCardSmallProps {
  node: NodeData & { data?: ICanvasNode };
  extra?: React.ReactNode;
}

export const NodeCard: React.FC<NodeCardSmallProps> = ({ node, extra }) => {
  return (
    <Card className=" shadow-lg w-[240px]">
      <CardHeader className=''>
        <CardTitle className='break-words'>{node?.label as string}</CardTitle>
        <CardDescription className='text-xs'>
          <div><strong>ID:</strong> {node?.id}</div>
          <div><strong>Label:</strong> {node?.data?.type || 'N/A'}</div>
        </CardDescription>
      </CardHeader>
      {
        extra ? <CardContent className='p-0'> {extra}</CardContent> : <></>
      }
    </Card>
  );
};

