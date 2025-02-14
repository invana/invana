import { Graph as G6Graph } from '@antv/g6';
import type { PropsWithChildren } from 'react';
import React, { CSSProperties, forwardRef, memo, useImperativeHandle } from 'react';
import type { GraphinProps } from '@antv/graphin';
import userGraph from '@antv/g6/hooks/useGraph';
import { CanvasGraphProps } from './types';
import useCanvasGraph from './hooks';

type GraphRef = G6Graph | null;


/**
 * Graphin, the react component for G6.
 */
const Graph = forwardRef<GraphRef, GraphinProps>((props, ref) => {
  const { graph, containerRef } = useCanvasGraph<GraphinProps>(props);

  useImperativeHandle(ref, () => graph!, [graph]);

  return <div ref={containerRef} ></div>;
});

export const CanvasGraph = memo(Graph);