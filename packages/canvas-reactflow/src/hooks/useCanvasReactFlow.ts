// import { useStoreApi } from '@xyflow/react';
import { useState } from 'react';


const useCanvasReactFlowStore = () => {

  // const store = useStoreApi();
  const [selectedField, setSelectedField] = useState<[string, string]>(['', '']);

  return {
    selectedField,
    setSelectedField
  }
}

export default useCanvasReactFlowStore;