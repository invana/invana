import React, { useState } from 'react';
// import { GraphinContext } from '@antv/graphin';
import { Card } from '@invana/ui';
import { Graph, NodeEvent } from '@antv/g6';


interface NodeContextMenuProps {
  getGraph: () => Graph;
  className?: string;
}




export const NodeContextMenu: React.FC<NodeContextMenuProps> = ({ getGraph, className }) => {
  // const { graph } = React.useContext(GraphinContext);

  // if (!graph) return

  const graph = getGraph();
  console.log("NodeContextMenu -> graph", graph)

  const [contextMenuData, setContextMenuData] = useState<{
    visible: boolean;
    x: number;
    y: number;
    nodeData: any;
  }>({
    visible: false,
    x: 0,
    y: 0,
    nodeData: null,
  });


  const handleNodeContextMenu = (e: any) => {
    e.preventDefault(); // Prevent the default browser context menu
    const { canvas } = e;
    console.log('handleNodeContextMenu CONTEXT_MENU event', e, canvas);
    // const model = item.getModel();

    setContextMenuData({
      visible: true,
      x: canvas.x,
      y: canvas.y,
      nodeData: {},
    });
  };

  const closeContextMenu = () => {
    setContextMenuData({
      ...contextMenuData,
      visible: false,
    });
  };

  // graph.on('edge:contextmenu', (evt) => {
  //   const edge = evt.item;  // The edge on which the context menu was triggered
  //   console.log('Edge right-clicked:', edge);
  // });
  graph.on(NodeEvent.CONTEXT_MENU, handleNodeContextMenu);
  // React.useEffect(() => {
  //   //@ts-ignore
  //   graph.on(NodeEvent.CONTEXT_MENU, handleNodeContextMenu);
  //   return () => {
  //     //@ts-ignore
  //     graph.off(NodeEvent.CONTEXT_MENU, handleNodeContextMenu);
  //   };
  // }, [graph]);

  console.log("contextMenu graph", graph)
  console.log("=====contextMenuData.visible", contextMenuData.visible)
  return (
    <>
      {/* <Graphin data={{ nodes: [], edges: [] }}> */}
      {/* Context Menu Overlay */}
      {contextMenuData.visible && (
        <div
          style={{
            position: 'absolute',
            top: contextMenuData.y,
            left: contextMenuData.x,
            zIndex: 10,
            pointerEvents: 'auto',
          }}
          onMouseLeave={closeContextMenu}
        >
          <Card>
            <div>
              <h3 className="font-bold">Node Information</h3>
              <p><strong>ID:</strong> {contextMenuData.nodeData.id}</p>
              <p><strong>Label:</strong> {contextMenuData.nodeData.label || 'N/A'}</p>
              <p className="text-gray-600">Right-click menu actions can go here.</p>
            </div>
          </Card>
        </div>
      )}
      {/* </Graphin> */}
    </>
  );
};

