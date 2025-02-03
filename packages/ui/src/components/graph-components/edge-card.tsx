

import { ICanvasEdge } from '@invana/data-store';
import { Card, CardHeader, CardTitle, CardDescription } from '@invana/ui';
import React from 'react';
import { ElementProperties } from './element-properties';
import { cn } from "../../lib/utils";



export interface EdgeCardProps {
  edge: ICanvasEdge;
  className?: string;
  showProperties?: boolean
  extra?: React.ReactNode;
}

export const EdgeCard: React.FC<EdgeCardProps> = ({ edge, extra, className = ' w-[260px]', showProperties = false }) => {
  console.log("EdgeCard edge", edge)
  return (
    <Card className={cn(" shadow-lg ", className)}>
      <CardHeader className=''>
        <CardTitle className='break-words'>{edge?.label as string}</CardTitle>
        <CardDescription className='text-xs'>
          <div><strong>ID:</strong> {edge?.id}</div>
          <div><strong>Label:</strong> {edge?.type || 'N/A'}</div>
          <div><strong>source</strong> {edge?.source}</div>
          <div><strong>target</strong> {edge?.target}</div>
        </CardDescription>
      </CardHeader>
      {
        showProperties && <ElementProperties className={"pr-3 pl-3"} properties={edge?.properties || {}} />
      }
      {extra && <div> {extra}</div>}
    </Card>
  );
};

