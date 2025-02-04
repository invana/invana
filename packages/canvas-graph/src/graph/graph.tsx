import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Graphin } from '@antv/graphin';
import { ExtensionCategory, Graph, GraphOptions, register } from '@antv/g6';
import { defaultOptions } from './defaults';
import { CanvasToolBar } from '../plugins';
import { CanvasManager } from '../manager';
import { ICanvasData } from '@invana/data-store';
import { NodeTooltipBehavior, EdgeTooltipBehavior, PropertyViewerBehavior } from '../behaviours';
import { NodeContextMenuBehavior } from '../behaviours/context-menus/node';
import { EdgeContextMenuBehavior } from '../behaviours/context-menus/edge';
import { CanvasContextMenuBehavior } from '../behaviours/context-menus/canvas';


register(ExtensionCategory.BEHAVIOR, 'tooltip-node', NodeTooltipBehavior, true);
register(ExtensionCategory.BEHAVIOR, 'tooltip-edge', EdgeTooltipBehavior, true);
register(ExtensionCategory.BEHAVIOR, 'node-context-menu', NodeContextMenuBehavior, true);
register(ExtensionCategory.BEHAVIOR, 'edge-context-menu', EdgeContextMenuBehavior, true);
register(ExtensionCategory.BEHAVIOR, 'canvas-context-menu', CanvasContextMenuBehavior, true);
register(ExtensionCategory.BEHAVIOR, 'property-viewer', PropertyViewerBehavior, true);


export interface CanvasGraphProps {
  initialData: ICanvasData;
  options?: Omit<GraphOptions, 'data'>;
  style?: React.CSSProperties;
  className?: string;
  // canvasManager?: CanvasManager; //comes with inbuilt graphStore or user can pass their own
  onReady?: () => void;
  header?: boolean;
}

const MemoizedGraphin = React.memo(Graphin);



export const CanvasGraph: React.FC<CanvasGraphProps> = forwardRef((props, ref) => {
  console.log("CanvasGraph props", props, "======")
  const { options, header = false } = props;
  const localRef = useRef<Graph | null>(null);
  const graphOptions: GraphOptions = { ...defaultOptions, ...options };
  //@ts-ignore
  const canvasManager = new CanvasManager(localRef.current, graphOptions);
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
    getGraphManager: () => {
      console.log("getGraphManager")
      return canvasManager
    }

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
          if (canvasManager) {
            canvasManager.setGraph(graph);
          }
          canvasManager?.store.addData(
            props.initialData ?? { 'nodes': [], 'edges': [] },
            () => canvasManager?.g6graph.render()
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
