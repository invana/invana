import { Graph as G6Graph } from '@antv/g6';
import React, { forwardRef, memo, useImperativeHandle } from 'react';
import type { GraphinProps } from '@antv/graphin';
import useGraphRenderer from './hooks';

type GraphRef = G6Graph | null;


/**
 * Graphin, the react component for G6.
 */
const Graph = forwardRef<GraphRef, GraphinProps>((props, ref) => {
  const { graph, containerRef } = useGraphRenderer<GraphinProps>(props);
  useImperativeHandle(ref, () => graph!, [graph]);
  return <div ref={containerRef} ></div>;
});

export const GraphRenderer = memo(Graph);