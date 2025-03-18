import React, { useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  Panel,
  Edge,
  Node,
  ReactFlowInstance,
  ReactFlowProvider,
} from "@xyflow/react";
import { FlowCanvasOptions } from "./types";
import '@xyflow/react/dist/style.css';
import { defaultFlowCanvasOptions } from "./defaults";
import { addNodeDefaults } from "./utils";
import { CanvasToolBar } from "../plugins/toolbars/CanvasToolBar";
import { DevTools } from "../plugins/toolbars/DevTools";
import { resetHandlePathHighlight } from "../interactions/EntityRelationHighlight";
import { mergeDeep } from "@invana/data-store";



export const CanvasFlow: React.FC<FlowCanvasOptions> = (useOptions) => {
  const options = mergeDeep(defaultFlowCanvasOptions, useOptions);
  const ref = useRef<ReactFlowInstance | null>(null);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const onInit = (reactFlowInstance: ReactFlowInstance<Node, Edge>) => {
    setFlowInstance(reactFlowInstance);
    // onLayoutUpdated(direction, reactFlowInstance);
  };
  const defaultNodes = options.nodes.map(
    node => addNodeDefaults(node, options.canvas?.defaultNodeOptions || {}, options.layoutDirection)
  )

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [nodes, _setNodes, onNodesChange] = useNodesState(defaultNodes);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [edges, _setEdges, onEdgesChange] = useEdgesState(options?.edges || []);


  useEffect(() => {
    console.log("Mode changed to:", options.canvas?.colorMode);
    const mode: "light" | "dark" = options.canvas?.colorMode === "system" ? "dark" : options.canvas?.colorMode || "dark"
    document.querySelector("html")?.setAttribute("data-canvas-theme", mode);
  }, [options.canvas?.colorMode]);

  // const [colorMode, setColorMode] = React.useState<ColorMode>(options.canvas?.colorMode || 'system');

  // const getActiveTheme = () => {
  //   const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  //   const activeTheme = colorMode === 'system' ? systemTheme : colorMode;
  //   return activeTheme
  // }

  // const toggleTheme = () => {
  //   const newTheme = getActiveTheme() === 'light' ? 'dark' : 'light';
  //   setColorMode(newTheme);
  // }

  const onPanelClick = (event: React.MouseEvent<Element, MouseEvent>) => {

    resetHandlePathHighlight(nodes, edges, _setNodes, _setEdges)
  }

  // console.log("colorMode", options.canvas?.colorMode);
  return (
    <div style={options.style}>
      <ReactFlowProvider>

        <ReactFlow
          // ref={ref}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodes={nodes}
          edges={edges}
          colorMode={options.canvas?.colorMode}
          onInit={onInit}
          // edgeStyles={{}}
          onPaneClick={onPanelClick}
          onEdgeClick={(event: React.MouseEvent, edge: Edge) => options.canvasInteractions && options.canvasInteractions.onEdgeClick(event, edge, flowInstance)}
          onEdgeMouseEnter={(event: React.MouseEvent, edge: Edge) => options.canvasInteractions && options.canvasInteractions.onEdgeMouseEnter(event, edge, flowInstance)}
          onEdgeMouseLeave={(event: React.MouseEvent, edge: Edge) => options.canvasInteractions && options.canvasInteractions.onEdgeMouseLeave(event, edge, flowInstance)}
          onNodeMouseEnter={(event: React.MouseEvent, node: Node) => options.canvasInteractions && options.canvasInteractions.onNodeMouseEnter(event, node, flowInstance)}
          onNodeMouseLeave={(event: React.MouseEvent, node: Node) => options.canvasInteractions && options.canvasInteractions.onNodeMouseLeave(event, node, flowInstance)}

          {...(options.canvas ? Object.fromEntries(
            Object.entries(options.canvas).filter(([key]) => key !== 'defaultNodeOptions' && key !== 'colorMode')
          ) : {})}
        >
          {options.display?.plugins?.miniMap && <MiniMap zoomable pannable position="bottom-left" />}
          {options.display?.plugins?.background && <Background {...options.background} />}
          {options.display?.plugins?.devTools &&
            <DevTools position="bottom-right" className=" border rounded shadow-sm" />
          }

          {options.display?.plugins?.controls &&
            <Panel position="top-left" className="transition-colors flex items-center border shadow-sm
              bg-card text-card-foreground ">
              <CanvasToolBar />
            </Panel>
          }

          {/* {options.display?.plugins?.colorMode &&
          <Panel position="top-right" className=" bg-card text-card-foreground border  flex items-center transition-colors">
            <ButtonWithTooltip
              variant="ghost"
              size="icon-sm"
              onClick={() => toggleTheme()}
              className="rounded-none"
              tooltip={<p>Toggle Theme</p>}
            >
              {
                getActiveTheme() === 'light'
                  ? <Sun className="h-4 w-4" />
                  : <Moon className="h-4 w-4" />
              }
            </ButtonWithTooltip>
          </Panel>
        } */}

          {options.children}
        </ReactFlow>
      </ReactFlowProvider>
    </div >
  );
};


