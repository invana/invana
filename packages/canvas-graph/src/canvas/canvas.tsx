import React, { memo, useEffect, useRef } from 'react';
import { Graph as GraphG6 } from '@antv/g6';
import { CanvasGraphProps } from './types';
import { CanvasManager } from '../manager';
import { CanvasManagerOptions } from '../manager/types';
import { DEFAULT_CANVAS_GRAPH_OPTIONS } from '../manager/defaults';
import { mergeDeep } from '@invana/data-store';

const Graph: React.FC<CanvasGraphProps> = (props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    // Only initialize if not already initialized
    if (!initialized.current && containerRef.current) {
      console.log("CanvasGraph.useEffect - initializing");

      const options: CanvasManagerOptions = mergeDeep(
        DEFAULT_CANVAS_GRAPH_OPTIONS,
        props.options ?? {}
      );
      const initData = props.initData ?? { nodes: [], edges: [] };
      const canvasManager: CanvasManager = new CanvasManager(containerRef
        .current, initData, options);
      props?.onReady?.(canvasManager);
      initialized.current = true;
    }

    return () => {
      console.log("CanvasGraph.cleanup");
      // Reset the initialization flag and defer destruction
      initialized.current = false;
      const graph = graphRef.current;
      if (graph && !graph.destroyed) {
        setTimeout(() => {
          graph.destroy();
          graphRef.current = null;
          if (props?.onDestroy) {
            props.onDestroy();
          }
        }, 0);
      }
    };
  }, []); // Empty dependency array ensures this effect runs only on mount/unmount

  return (
    <div
      ref={containerRef}
      id={props.graphName}
      className={`h-full w-full ${props.className || ''}`}
      style={props.containerStyle ?? {}}
    >
      Hello
    </div>
  );
};

export const CanvasGraph = memo(Graph);
// export const CanvasGraph: React.FC<CanvasGraphProps> = memo((props) => {
//   return Graph(props);
// });

