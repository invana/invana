import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Graphin } from '@antv/graphin';
import { ExtensionCategory, Graph, GraphOptions, register } from '@antv/g6';
import { defaultOptions } from './defaults';
// import { GraphStore } from '../graphStore';
import { CanvasToolBar } from '../plugins';
import { GraphManager } from '../graphManager';
import { ICanvasData } from '@invana/data-store';
// import { NodeContextMenu } from '../plugins/contextMenus/node';
import { NodeContextMenu } from '../plugins/node';
import { TooltipBehavior } from '../plugins/tooltip';
// import TooltipBehavior from '../behaviours/tooltip';
// import { CanvasToolBar } from '../plugins/';


// export const CanvasGraph: React.FC = (props) => {
//   const options: GraphOptions = { ...defaultOptions, ...props }
//   const [graph, setGraph] = React.useState<Graph | null>(null);
//   return (
//     <>
//       <ZoomControls graph={graph} />
//       <div style={{ width: 'calc(100% - 2px)', height: 'calc(100vh )' }}>
//         <Graphin
//           onReady={(graph) => setGraph(graph)}
//           options={options}
//         >
//         </Graphin>
//       </div>
//     </>
//   );
// }



register(ExtensionCategory.BEHAVIOR, 'custom-behavior', TooltipBehavior, true);

export interface CanvasGraphProps {
  initialData: ICanvasData;
  options?: Omit<GraphOptions, 'data'>;
  style?: React.CSSProperties;
  // graph?: Graph;
  graphManager?: GraphManager; //comes with inbuilt graphStore or user can pass their own
  onReady?: () => void;
  header?: boolean;
}


const MemoizedGraphin = React.memo(Graphin);


export const CanvasGraph: React.FC<CanvasGraphProps> = forwardRef((props, ref) => {
  console.log("CanvasGraph props", props, "======")
  console.log("CanvasGraph ref", ref);
  console.log("CanvasGraph graphManager", props.graphManager)
  const { options, style, header = false } = props;

  const localRef = useRef<Graph | null>(null);
  //@ts-ignore
  const graphManager = props.graphManager ? props.graphManager : new GraphManager(null);


  const graphOptions: GraphOptions = { ...defaultOptions, ...options };
  // const [graphStore, setGraphStore] = React.useState<GraphStore | null>(null);

  const [graph, setGraph] = React.useState<Graph | null>(null);
  // const graphRef = React.useRef<Graph | null>(props.graph ?? null);


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


  // graph?.on(NodeEvent.POINTER_ENTER, (event: IEvent) => {
  //   console.log('POINTER_ENTER event', event);
  //   // graph.updateNodeData([{ id: target.id, style: { labelText: 'Hover me!', fill: '#5B8FF9', labelFill: 'black' } }]);
  //   // graph.draw();
  // });

  // graph?.on(NodeEvent.POINTER_OUT, (event: IEvent) => {
  //   console.log('POINTER_OUT event', event);
  //   // graph.updateNodeData([{ id: target.id, style: { labelText: 'Hover me!', fill: '#5B8FF9', labelFill: 'black' } }]);
  //   // graph.draw();
  // });


  // const GraphStore = new GraphStore(graph);


  // props.graph?.on(NodeEvent.CLICK, (event: IEvent) => {
  //   console.log('node.CLICK event', event);
  //   // graph.updateNodeData([{ id: target.id, style: { labelText: 'Hover me!', fill: '#5B8FF9', labelFill: 'black' } }]);
  //   // graph.draw();
  // });

  // Event listener for right-click on nodes
  // graph?.on(NodeEvent.CONTEXT_MENU, (evt: IEvent) => {
  //   console.log('CONTEXT_MENU event', evt);
  //   // (evt.originalEvent as MouseEvent).preventDefault();

  //   const menuItems: MenuItem[] = [
  //     {
  //       id: 'files',
  //       label: 'Files',
  //       // icon: File,
  //       shortcut: '⌘F',
  //       children: [
  //         {
  //           id: 'shared',
  //           label: 'Shared Files',
  //           icon: FolderOpen,
  //           shortcut: '⌘S',
  //         },
  //         {
  //           id: 'recent',
  //           label: 'Recent Files',
  //           // icon: File,
  //           shortcut: '⌘R',
  //         }
  //       ]
  //     }
  //   ];
  //   < NestedMenu menuItems={menuItems} />
  // });


  console.log("props.initialData", props.initialData);

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
    <div style={props?.style || {}} className='graph-canvas'>
      {graph && header && <CanvasToolBar getGraph={() => graph} />}
      {graph && <NodeContextMenu getGraph={() => graph} />}

      <MemoizedGraphin
        ref={localRef}
        onReady={(graph) => {
          if (graphManager) {
            graphManager.setGraph(graph);
          }


          // const nodeMenu = new NodeContextMenu();
          // nodeMenu.init(graph);

          graphManager?.graphStore.addData(
            props.initialData ?? { 'nodes': [], 'edges': [] },
            () => graphManager?.g6graph.render()
          );
          setGraph(graph);
          // graphRef.current = graph;
          if (props.onReady) {
            props.onReady();
          } else {
            console.log("CanvasGraph -> onReady", "no onReady callback")
          }
        }}
        style={style}
        options={graphOptions}
      >

      </MemoizedGraphin>
    </div>
  );
})
