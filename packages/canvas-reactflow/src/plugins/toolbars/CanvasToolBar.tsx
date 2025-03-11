import React from 'react';
import { ViewportControls } from '../options/ViewportControls/ViewportControls';
import { CanvasControls } from '../options/CanvasControls/CanvasControls';
import { Separator } from '@invana/ui';


export const CanvasToolBar: React.FC = () => {

  return (
    <>
      <ViewportControls />
      <Separator orientation="vertical" className="h-4" />
      <CanvasControls />
    </>
  );
};
