

import { EdgeData } from '@antv/g6';
import { ICanvasEdge } from '@invana/data-store';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@invana/ui';
import React from 'react';


interface EdgeCardSmallProps {
  edge: EdgeData & { data?: ICanvasEdge };
  extra?: React.ReactNode;
}

export const EdgeCard: React.FC<EdgeCardSmallProps> = ({ edge, extra }) => {
  console.log("EdgeCard edge", edge)
  return (
    <Card className=" shadow-lg w-[240px]">
      <CardHeader className=''>
        <CardTitle className='break-words'>{edge?.label as string}</CardTitle>
        <CardDescription className='text-xs'>
          <div><strong>ID:</strong> {edge?.id}</div>
          <div><strong>Label:</strong> {edge.data?.type || 'N/A'}</div>
          <div><strong>source</strong> {edge?.source}</div>
          <div><strong>target</strong> {edge?.target}</div>
        </CardDescription>
      </CardHeader>
      {
        extra ? <CardContent className='p-0'> {extra}</CardContent> : <></>
      }
    </Card>
  );
};

