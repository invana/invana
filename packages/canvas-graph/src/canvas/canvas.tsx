import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Graphin } from '@antv/graphin';
import { Graph } from '@antv/g6';
import { CanvasGraphProps } from './types';
import { CanvasManager } from '../manager';
import { CanvasManagerOptions } from '../manager/types';
import { DEFAULT_CANVAS_GRAPH_OPTIONS } from '../manager/defaults';
import { mergeDeep } from '@invana/data-store';



export interface GraphinRef extends Graph {
  graph: Graph;
}

export const CanvasGraph: React.FC<CanvasGraphProps> = forwardRef((props, ref) => {
  // Sample graph data

  // Ref for Graphin instance

  // Update layout
  // For Graphin 3.x "force" is generally "grid", plus other options like "circular", "concentric", etc.
  // const handleLayoutChange = (layoutType: 'circular' | 'grid' | 'radial') => {
  //   if (graphinRef.current?.graph) {
  //     graphinRef.current.graph.setLayout({ type: layoutType });
  //     graphinRef.current.graph.layout();
  //   }
  // };


  // useEffect(() => {
  //   const handleContextMenu = (event: MouseEvent) => event.preventDefault();
  //   document.querySelectorAll('.graph-canvas').forEach(
  //     () => addEventListener("contextmenu", handleContextMenu));

  //   return () => {
  //     document.querySelectorAll('.graph-canvas').forEach(
  //       () => removeEventListener("contextmenu", handleContextMenu));
  //   };
  // }, []);

  const localRef = useRef<Graph | null>(null);
  const graphManagerRef = useRef<CanvasManager | null>(null);

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
      console.log("getGraphManager called", graphManagerRef.current);
      return graphManagerRef.current;
    }
    // getGraphManager: () => {
    //   console.log("getGraphManager")
    //   return graphManager
    // }

  }));




  const options: CanvasManagerOptions = mergeDeep(DEFAULT_CANVAS_GRAPH_OPTIONS, props.options ?? {});
  console.log("=======options CanvasManagerOptions", options)
  const initData = props.initData ?? { 'nodes': [], 'edges': [] }

  return (
    <div className='h-full w-full' style={props.containerStyle ?? {}}>
      <Graphin
        ref={localRef}
        options={{}}
        onReady={(graph) => {
          console.log("Graphin onReady", graph);
          const canvasManager: CanvasManager = new CanvasManager(graph, options);
          canvasManager.store.addData(initData, () => canvasManager.render());
          props?.onReady?.(canvasManager);
          graphManagerRef.current = canvasManager;
        }}
        onDestroy={() => {
          console.log("Graphin onDestroy");
          // localRef.current?.destroy();
          props?.onDestroy?.();
        }}
      // ref={graphinRef}
      />
      {/* <div style={{ marginTop: '10px' }}>
        <Button className='mr-3' onClick={() => handleLayoutChange('circular')}>Circular Layout</Button>
        <Button onClick={() => handleLayoutChange('grid')}>Grid Layout</Button>
      </div> */}
    </div>
  );
});

