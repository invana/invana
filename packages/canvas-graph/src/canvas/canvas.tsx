import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Graph } from '@antv/g6';
import { CanvasGraphProps } from './types';
import { CanvasManager } from '../manager';
import { mergeDeep } from '@invana/data-store';
import { DEFAULT_CANVAS_GRAPH_OPTIONS } from '../manager/defaults';
import { GraphRenderer } from '../renderer';



// export interface GraphinRef extends Graph {
//   graph: Graph;
// }
// const MemoizedGraphin = React.memo(Graphin, () => true);

export const CanvasGraph: React.FC<CanvasGraphProps> = React.memo(forwardRef((props, ref) => {

  // useEffect(() => {
  //   const handleContextMenu = (event: MouseEvent) => event.preventDefault();
  //   document.addEventListener("contextmenu", handleContextMenu);

  //   return () => {
  //     document.removeEventListener("contextmenu", handleContextMenu);
  //   };
  // }, []);


  const localRef = useRef<Graph | null>(null);
  // const canvasManagerRef = useRef<CanvasManager | null>(null);

  useImperativeHandle(ref, () => ({
    // Expose methods or properties to the parent component
    // get: () => {
    //   console.log('someMethod called');
    // },
    getGraph: () => {
      console.log("getGraph called", localRef.current);
      return localRef.current;
    },
    getGraphManager: () => {
      // console.log("getGraphManager called", canvasManagerRef.current);
      // return canvasManagerRef.current;
    }
    // getGraphManager: () => {
    //   console.log("getGraphManager")
    //   return canvasManager
    // }

  }));

  const canvasManager = useRef<CanvasManager | null>(null);

  useEffect(() => {
    return () => {
      canvasManager.current?.destroy();
    };
  }, []);

  // const optionsRef = useRef<CanvasManagerOptions>(mergeDeep(DEFAULT_CANVAS_GRAPH_OPTIONS, props.options ?? {}));
  console.log("=======CanvasGraph.loaded options CanvasManagerOptions", props.graphName, props.options,)

  console.log("Graphin options======", props.graphName)
  return (
    <GraphRenderer
      ref={localRef}
      id={props.graphName}
      style={props.containerStyle ?? {}}
      options={{}}
      onReady={(graph) => {
        const options = mergeDeep(DEFAULT_CANVAS_GRAPH_OPTIONS, props.options || {})
        const initData = props.initData ?? { 'nodes': [], 'edges': [] }
        console.log("Graphin onReady", props.graphName, graph, options);
        canvasManager.current = new CanvasManager(graph, options);
        if (canvasManager.current) {
          canvasManager.current.store.addData(initData, () => canvasManager.current?.render());
        }
        if (props.onReady) {
          props?.onReady?.(canvasManager.current);
        }
        // canvasManagerRef.current = canvasManager;
      }}
      // onDestroy={() => {
      onDestroy={() => {
        console.log("Graphin onDestroy");
        // localRef.current?.destroy();
        canvasManager.current?.destroy();
        props?.onDestroy?.();
      }}
    // ref={graphinRef}
    />
  );
}));
