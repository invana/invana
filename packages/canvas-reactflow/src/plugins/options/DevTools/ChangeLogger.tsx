import React, {
  useEffect,
  useState,
  useCallback
} from 'react';

import {
  useStoreApi,
  type OnNodesChange,
  type NodeChange,
} from '@xyflow/react';


type ChangeLoggerProps = {
  color?: string;
  limit?: number;
};

type ChangeInfoProps = {
  change: NodeChange;
  className?: string;
};

export const ChangeInfo: React.FC<ChangeInfoProps> = ({ change, className = '' }) => {
  const id = 'id' in change ? change.id : '-';
  const { type } = change;

  return (
    <div className={"mb-3 " + className}>
      <div>node id: {id}</div>
      <div>
        {type === 'add' ? JSON.stringify(change.item, null, 2) : null}
        {type === 'dimensions'
          ? `dimensions: ${change.dimensions?.width} × ${change.dimensions?.height}`
          : null}
        {type === 'position'
          ? `position: ${change.position?.x.toFixed(1)}, ${change.position?.y.toFixed(1)}`
          : null}
        {type === 'remove' ? 'remove' : null}
        {type === 'select' ? (change.selected ? 'select' : 'unselect') : null}
      </div>
    </div>
  );
}

export const ChangeLogger: React.FC<ChangeLoggerProps> = ({ limit = 20 }) => {
  const [changes, setChanges] = useState<NodeChange[]>([]);
  const store = useStoreApi();

  // Memoize the callback for handling node changes
  const handleNodeChanges: OnNodesChange = useCallback(
    (newChanges: NodeChange[]) => {
      setChanges((prevChanges) => [...newChanges, ...prevChanges].slice(0, limit));
    },
    [limit]
  );

  useEffect(() => {
    store.setState({ onNodesChange: handleNodeChanges });

    return () => store.setState({ onNodesChange: undefined });
  }, [handleNodeChanges, store]);

  const NoChanges = () => <div>No Changes Triggered</div>;

  return (
    <>
      {changes.length === 0 ? (
        <NoChanges />
      ) : (
        changes.map((change, index) => <ChangeInfo key={index} change={change} className={"border-b pb-1"} />)
      )}
    </>
  );
}