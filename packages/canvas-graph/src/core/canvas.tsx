import React, { useRef } from 'react';
import { Graphin } from '@antv/graphin';
import { CanvasGraphProps } from '../types';
import { CanvasManager } from '../canvas/manager';


const CanvasGraph_: React.FC<CanvasGraphProps> = (props) => {

  const canvasManagerRef = useRef<CanvasManager | null>(null);

  // useEffect(() => {
  //   return () => {
  //     console.log("CanvasGraph useEffect cleanup");
  //     canvasManagerRef.current?.destroy();
  //   }
  // }, [])

  console.log("CanvasGraph props", props)
  console.log("CanvasGraph graph", canvasManagerRef.current)
  // useEffect(() => {
  //   const disableRightClick = (e: MouseEvent) => e.preventDefault();
  //   document.addEventListener("contextmenu", disableRightClick);

  //   return () => {
  //     document.removeEventListener("contextmenu", disableRightClick);
  //   };
  // }, []);
  console.log("CanvasGraph.props", props)
  const propsSizeInBytes = new Blob([JSON.stringify(props)]).size;
  console.log(`CanvasGraph.props Props size: ${propsSizeInBytes} bytes`);
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

// export const CanvasGraph = React.memo(CanvasGraph_, (prevProps, nextProps) => {
//   // Compare relevant props to determine if a re-render is needed
//   return JSON.stringify(prevProps.initData) === JSON.stringify(nextProps.initData) &&
//     JSON.stringify(prevProps.options) === JSON.stringify(nextProps.options) &&
//     prevProps.className === nextProps.className &&
//     prevProps.containerStyle === nextProps.containerStyle;
// });

// export const CanvasGraph = CanvasGraph_;

export const CanvasGraph = React.memo(CanvasGraph_)