import React from 'react';
import {
  useNodes,
  type XYPosition,
  ViewportPortal,
  useReactFlow
} from '@xyflow/react';


export const NodeInspector = (): JSX.Element => {
  const { getInternalNode } = useReactFlow();
  const nodes = useNodes();

  return (
    <ViewportPortal>
      <div className='text-secondary-foreground'>
        {nodes.map((node) => {
          const internalNode = getInternalNode(node.id);
          if (!internalNode) {
            return null;
          }

          const absPosition = internalNode?.internals.positionAbsolute;

          return (
            <NodeInfo
              key={node.id}
              id={node.id}
              selected={!!node.selected}
              type={node.type || 'default'}
              position={node.position}
              absPosition={absPosition}
              width={node.measured?.width ?? 0}
              height={node.measured?.height ?? 0}
              data={node.data}
            />
          );
        })}
      </div>
    </ViewportPortal>
  );
}

export type NodeInfoProps = {
  id: string;
  type: string;
  selected: boolean;
  position: XYPosition;
  absPosition: XYPosition;
  width?: number;
  height?: number;
  data: any;
};

export const NodeInfo: React.FC<NodeInfoProps> = ({
  id,
  type,
  selected,
  position,
  absPosition,
  width,
  height,
  data,
}) => {
  if (!width || !height) return null;

  const absoluteTransform = `translate(${absPosition.x}px, ${absPosition.y + height}px)`;
  const formattedPosition = `${position.x.toFixed(1)}, ${position.y.toFixed(1)}`;
  const formattedDimensions = `${width} × ${height}`;
  const selectionStatus = selected ? 'Selected' : 'Not Selected';

  return (
    <div
      style={{
        position: 'absolute',
        transform: absoluteTransform,
        width: width * 2,
      }}
      className='text-xs'
    >
      <div>id: {id}</div>
      <div>type: {type}</div>
      <div>selected: {selectionStatus}</div>
      <div>position: {formattedPosition}</div>
      <div>dimensions: {formattedDimensions}</div>
      <div>data: {JSON.stringify(data, null, 2)}</div>
    </div>
  );
};
