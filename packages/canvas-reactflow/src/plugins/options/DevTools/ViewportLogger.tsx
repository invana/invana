import { useStore } from '@xyflow/react';


export const ViewportLogger = () => {
  const viewport = useStore(
    (s) =>
      `x: ${s.transform[0].toFixed(2)}, y: ${s.transform[1].toFixed(2)}, zoom: ${s.transform[2].toFixed(2)}`,
  );
  return <div className={'!text-sm'}>{viewport}</div>;
};