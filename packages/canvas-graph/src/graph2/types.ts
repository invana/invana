import { ICanvasData, ICanvasStyle } from '@invana/data-store';
import React from 'react';
import { GraphManager } from '../graphManager';

// export interface CanvasInteractions {
//   plugins: object[]
//   behaviors: object[]
// }


export interface CanvasGraphV2Props {
  initData?: ICanvasData
  display?: ICanvasStyle
  style?: React.CSSProperties;
  onReady: (graphManager: GraphManager) => void;

  // interactions: CanvasInteractions
  // layouts: object[]

}