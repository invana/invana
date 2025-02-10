import { ICanvasData } from '@invana/data-store';
import React from 'react';
import { CanvasManager } from '../manager';
import { CanvasManagerOptions } from '../manager/types';

// export interface CanvasInteractions {
//   plugins: object[]
//   behaviors: object[]
// }


export interface CanvasGraphProps {
  graphName?: string
  initData?: ICanvasData
  options?: CanvasManagerOptions
  containerStyle?: React.CSSProperties;
  onReady?: (canvasManager: CanvasManager) => void;
  onDestroy?: () => void;
  className?: string;
  showHeader?: boolean;

  // interactions: CanvasInteractions
  // layouts: object[]

}