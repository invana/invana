import React, { memo, useEffect, useRef } from 'react';
import { Graph as GraphG6 } from '@antv/g6';
import { CanvasGraphProps } from './types';
import { CanvasManager } from '../manager';
import { CanvasManagerOptions } from '../manager/types';
import { DEFAULT_CANVAS_GRAPH_OPTIONS } from '../manager/defaults';
import { mergeDeep } from '@invana/data-store';

const Graph: React.FC<CanvasGraphProps> = (props) => {

  // Sample graph data
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef: React.MutableRefObject<GraphG6 | null> = useRef(null);

  useEffect(() => {

    if (containerRef.current) {
      const graph = new GraphG6({
        container: containerRef.current,
      });
      graphRef.current = graph;
      console.log("Created graph")
      const options: CanvasManagerOptions = mergeDeep(DEFAULT_CANVAS_GRAPH_OPTIONS, props.options ?? {});
      console.log("CanvasGraph.options", options);
      const initData = props.initData ?? { 'nodes': [], 'edges': [] }
      const canvasManager: CanvasManager = new CanvasManager(graph, options);
      canvasManager.store.addData(initData, () => canvasManager.render());
      props?.onReady?.(canvasManager);
    }
    return () => {
      console.log("CanvasGraph.cleanup");
      const graph = graphRef.current;
      if (graph) {
        // Defer destruction to avoid unmounting during render
        // setTimeout(() => {
        graph.destroy();
        graphRef.current = null;
        if (props?.onDestroy) {
          props?.onDestroy?.();
        }
        // }, 0);
      }
    }
  }, []);


  console.log("CanvasGraph.props", props);
  return (
    <div
      ref={containerRef}
      id={props.graphName}
      className={`h-full w-full ${props.className || ''}`}
      style={props.containerStyle ?? {}
      }>
    </div>
  );
};

export const CanvasGraph = memo(Graph);

