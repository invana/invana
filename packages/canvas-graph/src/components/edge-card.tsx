

import { EdgeData } from '@antv/g6';
import { ICanvasEdge } from '@invana/data-store';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@invana/ui';
import React from 'react';
import { ElementProperties } from './element-properties';


interface EdgeCardSmallProps {
  edge: EdgeData & { data?: ICanvasEdge };
  showProperties?: boolean
  extra?: React.ReactNode;
}

export const EdgeCard: React.FC<EdgeCardSmallProps> = ({ edge, extra, showProperties = false }) => {
  console.log("EdgeCard edge", edge)
  return (
    <Card className=" shadow-lg w-[260px]">
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
        showProperties && <ElementProperties properties={edge.data?.properties || {}} />
      }
      {extra && <div> {extra}</div>}
    </Card>
  );
};

