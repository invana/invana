import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Graphin } from '@antv/graphin';
import { Graph } from '@antv/g6';
import { CanvasGraphProps } from './types';
import { CanvasManager } from '../manager';
import { CanvasManagerOptions } from '../manager/types';
import { DEFAULT_CANVAS_GRAPH_OPTIONS } from '../manager/defaults';
import { mergeDeep } from '@invana/data-store';
import { CanvasToolBar } from '../plugins';


// export interface GraphinRef extends Graph {
//   graph: Graph;
// }
const MemoizedGraphin = React.memo(Graphin);

export const CanvasGraph: React.FC<CanvasGraphProps> = forwardRef((props: CanvasGraphProps, ref) => {
  const { showHeader = false } = props;
  const [isGraphReady, setIsGraphReady] = React.useState(false);

  const localRef = useRef<Graph | null>(null);
  const canvasManagerRef = useRef<CanvasManager | null>(null);

  useImperativeHandle(ref, () => ({
    // Expose methods or properties to the parent component
    getGraph: () => {
      return localRef.current;
    },
    getGraphManager: () => {
      return canvasManagerRef.current;
    }
  }));

  const options: CanvasManagerOptions = mergeDeep(DEFAULT_CANVAS_GRAPH_OPTIONS, props.options ?? {});
  const initData = props.initData ?? { 'nodes': [], 'edges': [] }
  console.log("CanvasGraph loaded", options);
  return (
    <div className='h-full w-full bg-background' style={props.containerStyle ?? {}}>

      {
        isGraphReady && showHeader && <CanvasToolBar className='h-50 bg-background text-foreground' getCanvasManager={() => canvasManagerRef.current as CanvasManager} />
      }
      <MemoizedGraphin
        key={props?.key}
        ref={localRef}
        options={options}
        onReady={(graph) => {
          console.log("Graphin onReady", graph);
          const canvasManager: CanvasManager = new CanvasManager(graph, options);
          canvasManager.store.addData(initData, () => canvasManager.render());
          props?.onReady?.(canvasManager);
          canvasManagerRef.current = canvasManager;
          setIsGraphReady(true);
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

