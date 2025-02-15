import React, { useEffect, useRef } from 'react';
import { mergeDeep } from '@invana/data-store';
import { Graphin } from '@antv/graphin';
import { CanvasGraphProps } from '../types';
import { DEFAULT_CANVAS_GRAPH_OPTIONS } from '../styling/defaults';
import { CanvasManager } from '../canvas/manager';


const CanvasGraph_: React.FC<CanvasGraphProps> = (props) => {

  const canvasManagerRef = useRef<CanvasManager | null>(null);

  useEffect(() => {

    return () => {
      console.log("CanvasGraph useEffect cleanup");
      canvasManagerRef.current?.destroy();
    }
  }, [])

  console.log("CanvasGraph -> props", props)
  console.log("CanvasGraph -> graph", canvasManagerRef.current)

  return (
    <Graphin
      onReady={(graph) => {
        const options = mergeDeep(DEFAULT_CANVAS_GRAPH_OPTIONS, props.options || {})
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

export const CanvasGraph = React.memo(CanvasGraph_);