import { ICanvasData, ICanvasStyleOptions } from '@invana/data-store';
import React from 'react';
import { CanvasManager } from '../manager';

// export interface CanvasInteractions {
//   plugins: object[]
//   behaviors: object[]
// }


export interface CanvasGraphV2Props {
  initData?: ICanvasData
  styles?: ICanvasStyleOptions
  containerStyle?: React.CSSProperties;
  onReady: (canvasManager: CanvasManager) => void;

  // interactions: CanvasInteractions
  // layouts: object[]

}