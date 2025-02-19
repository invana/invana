import React, { useEffect, useRef } from 'react';
import { Graphin } from '@antv/graphin';
import { CanvasGraphProps } from '../types';
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
      className={props.className || ' overflow-none'}
      onReady={(graph) => {
        const options = props.options
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