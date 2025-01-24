import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@invana/ui';
import { Graph, IElementEvent, NodeData, NodeEvent } from '@antv/g6';
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
    nodeData: (NodeData & { data?: ICanvasNode }) | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    nodeData: null,
  });

  const handleNodeContextMenu = (e: IElementEvent) => {
    // e.preventDefault();
    e.originalEvent.stopPropagation()
    e.originalEvent.preventDefault()

    const node = graph.getNodeData(e.target.id) as (NodeData & { data?: ICanvasNode });


    // graph.setElementState(node.id, 'dragging', false);
    console.log("handleNodeContextMenu -> e", e)
    const { canvas, client } = e;
    console.log('handleNodeContextMenu CONTEXT_MENU event', e, canvas, client, node,);
    console.log("nodeStyle", node.style, node?.style?.x)
    // const point = graph.getClientByCanvas({ x: node?.clientX ?? 0, y: node?.clientY ?? 0 });
    // console.log("nodeStyle, point", point)

    setContextMenuData({
      visible: true,
      x: client.x,
      y: client.y,
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
            width: 240,
            top: contextMenuData.y,
            left: contextMenuData.x,
            zIndex: 10000,
            pointerEvents: 'auto',
          }}
          onMouseLeave={closeContextMenu}
        >
          <Card>
            <CardHeader>
              <CardTitle className='text-xl'>{contextMenuData?.nodeData?.label as string}</CardTitle>
              {contextMenuData?.nodeData?.style?.x ?? 0}, {contextMenuData?.nodeData?.style?.y ?? 0}
            </CardHeader>

            <CardContent>
              <div>
                {/* <h3 className="font-bold ">Node Information</h3> */}
                <p><strong>ID:</strong> {contextMenuData?.nodeData?.id}</p>
                <p><strong>Label:</strong> {contextMenuData?.nodeData?.data?.type || 'N/A'}</p>
                {/* <p className="text-gray-600">Right-click menu actions can go here.</p> */}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};

