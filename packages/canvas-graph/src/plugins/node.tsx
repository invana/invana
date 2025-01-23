import React, { useState } from 'react';
import { Card, CardContent } from '@invana/ui';
import { Graph, NodeEvent } from '@antv/g6';
import { ICanvasNode } from '@invana/data-store';


interface NodeContextMenuProps {
  getGraph: () => Graph;
  className?: string;
}

export const NodeContextMenu: React.FC<NodeContextMenuProps> = ({ getGraph, className }) => {
  console.log("NodeContextMenu -> getGraph", getGraph, className)
  // const { graph } = React.useContext(GraphinContext);
  const graph = getGraph();
  console.log("NodeContextMenu -> graph", graph)

  const [contextMenuData, setContextMenuData] = useState<{
    visible: boolean;
    x: number;
    y: number;
    nodeData: ICanvasNode | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    nodeData: null,
  });

  const handleNodeContextMenu = (e: any) => {
    e.preventDefault();
    console.log("handleNodeContextMenu -> e", e)
    const { canvas } = e;
    const node = graph.getNodeData(e.target.id);
    console.log('handleNodeContextMenu CONTEXT_MENU event', e, canvas, node);
    setContextMenuData({
      visible: true,
      x: canvas.x,
      y: canvas.y,
      nodeData: node,
    });
  };

  const closeContextMenu = () => {
    setContextMenuData({
      ...contextMenuData,
      visible: false,
    });
  };

  graph.on(NodeEvent.CONTEXT_MENU, handleNodeContextMenu);

  React.useEffect(() => {
    graph.on(NodeEvent.CONTEXT_MENU, handleNodeContextMenu);
    return () => {
      graph.off(NodeEvent.CONTEXT_MENU, handleNodeContextMenu);
    };
  }, [graph]);

  console.log("=====contextMenuData", contextMenuData)
  return (
    <>
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
            <CardContent>
              <div>
                <h3 className="font-bold text-2xl">Node Information</h3>
                <p><strong>ID:</strong> {contextMenuData?.nodeData?.id}</p>
                <p><strong>Label:</strong> {contextMenuData?.nodeData?.data?.type || 'N/A'}</p>
                <p className="text-gray-600">Right-click menu actions can go here.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};

