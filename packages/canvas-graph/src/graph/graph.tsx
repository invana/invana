import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Graphin } from '@antv/graphin';
import { ExtensionCategory, Graph, GraphOptions, register } from '@antv/g6';
import { defaultOptions } from './defaults';
import { CanvasToolBar } from '../plugins';
import { GraphManager } from '../graphManager';
import { ICanvasData } from '@invana/data-store';
import { NodeTooltipBehavior, EdgeTooltipBehavior } from '../behaviours';
import { NodeContextMenuBehavior } from '../behaviours/context-menus/node';
import { EdgeContextMenuBehavior } from '../behaviours/context-menus/edge';
import { CanvasContextMenuBehavior } from '../behaviours/context-menus/canvas';


register(ExtensionCategory.BEHAVIOR, 'tooltip-node', NodeTooltipBehavior, true);
register(ExtensionCategory.BEHAVIOR, 'tooltip-edge', EdgeTooltipBehavior, true);
register(ExtensionCategory.BEHAVIOR, 'node-context-menu', NodeContextMenuBehavior, true);
register(ExtensionCategory.BEHAVIOR, 'edge-context-menu', EdgeContextMenuBehavior, true);
register(ExtensionCategory.BEHAVIOR, 'canvas-context-menu', CanvasContextMenuBehavior, true);


export interface CanvasGraphProps {
  initialData: ICanvasData;
  options?: Omit<GraphOptions, 'data'>;
  style?: React.CSSProperties;
  className?: string;
  // graph?: Graph;
  graphManager?: GraphManager; //comes with inbuilt graphStore or user can pass their own
  onReady?: () => void;
  header?: boolean;
}


const MemoizedGraphin = React.memo(Graphin);


export const CanvasGraph: React.FC<CanvasGraphProps> = forwardRef((props, ref) => {
  console.log("CanvasGraph props", props, "======")
  const { options, header = false } = props;
  const localRef = useRef<Graph | null>(null);
  //@ts-ignore
  const graphManager = props.graphManager ? props.graphManager : new GraphManager(null);
  const graphOptions: GraphOptions = { ...defaultOptions, ...options };
  const [graph, setGraph] = React.useState<Graph | null>(null);

  useImperativeHandle(ref, () => ({
    // Expose methods or properties to the parent component
    get: () => {
      console.log('someMethod called');
    },
    getGraph: () => {
      console.log("getGraph called", localRef.current);
      return localRef.current;
    },
  }));

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => event.preventDefault();
    document.querySelectorAll('.graph-canvas').forEach(
      () => addEventListener("contextmenu", handleContextMenu));

    return () => {
      document.querySelectorAll('.graph-canvas').forEach(
        () => removeEventListener("contextmenu", handleContextMenu));
    };
  }, []);

  return (
    <div style={props?.style || {}} className={'graph-canvas  ' + props.className || ''}>
      {graph && header && <CanvasToolBar getGraph={() => graph} />}
      <MemoizedGraphin
        ref={localRef}
        onReady={(graph) => {
          if (graphManager) {
            graphManager.setGraph(graph);
          }
          graphManager?.graphStore.addData(
            props.initialData ?? { 'nodes': [], 'edges': [] },
            () => graphManager?.g6graph.render()
          );
          setGraph(graph);
          if (props.onReady) {
            props.onReady();
          } else {
            console.log("CanvasGraph -> onReady", "no onReady callback")
          }
        }}
        // style={style}
        options={graphOptions}
      >

      </MemoizedGraphin>
    </div>
  );
})
