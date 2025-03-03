import React, { useEffect, useRef } from 'react';
import { Graphin } from '@antv/graphin';
import { Graph } from '@antv/g6';
import { CanvasGraphOptions, CanvasGraphProps } from '../types';
import { CanvasManager } from '../canvas/manager';
import { mergeDeep } from '@invana/data-store';
import { DEFAULT_CANVAS_GRAPH_OPTIONS } from '../styling/defaults';


const CanvasGraph_: React.FC<CanvasGraphProps> = (props) => {

  const canvasManagerRef = useRef<CanvasManager | null>(null);
  const graphRef = useRef<Graph>(null);

  useEffect(() => {
    const disableRightClick = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", disableRightClick);
    return () => {
      document.removeEventListener("contextmenu", disableRightClick);
    };
  }, []);

  console.log("CanvasGraph.props", props);


  // const propsSizeInBytes = new Blob([JSON.stringify(props)]).size;
  // console.log(`CanvasGraph.props Props size: ${propsSizeInBytes} bytes`);
  return (
    <Graphin
      ref={graphRef}
      className={props.className || ' overflow-none'}
      onReady={(graph) => {
        const options: CanvasGraphOptions = mergeDeep(DEFAULT_CANVAS_GRAPH_OPTIONS, props.options || {});
        const initData = props.initData ?? { 'nodes': [], 'edges': [] }
        console.log("Graphin onReady", props.graphName, graph, options);
        canvasManagerRef.current = new CanvasManager(graph, options);
        if (canvasManagerRef.current) {
          canvasManagerRef.current.store.addData(initData, () => canvasManagerRef.current?.render());
        }
        if (props.onReady) {
          props?.onReady?.(canvasManagerRef.current);
        }
      }}
      onDestroy={() => {
        console.log("Graphin onDestroy");
        const mgr = canvasManagerRef.current;
        canvasManagerRef.current = null;
        mgr?.destroy();

        props?.onDestroy?.();
      }}
      options={{}}
      style={props.containerStyle}
    />
  )
}

export const CanvasGraph = React.memo(CanvasGraph_, () => true);