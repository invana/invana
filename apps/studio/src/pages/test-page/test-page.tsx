import { useThemeStore } from "@invana/ui"
import { Graphin } from '@antv/graphin';


const graphData1 = {
  nodes: [
    { id: 'node-1', label: 'Node 1', style: { keyshape: { fill: 'blue' } } },
    { id: 'node-2', label: 'Node 2', style: { keyshape: { fill: 'red' } } },
  ],
  edges: [
    { source: 'node-1', target: 'node-2', label: 'Edge 1-2' },
  ],
};

const graphData2 = {
  nodes: [
    { id: 'node-A', label: 'Node A', style: { keyshape: { fill: 'green' } } },
    { id: 'node-B', label: 'Node B', style: { keyshape: { fill: 'orange' } } },
  ],
  edges: [
    { source: 'node-A', target: 'node-B', label: 'Edge A-B' },
  ],
};

export const TestPage: React.FC = () => {

  const { theme, } = useThemeStore()

  return <div style={{ "background": '#222' }} className="h-screen w-screen flex items-center justify-center bg-background text-foreground">

    {/* <div style={{ display: 'flex', gap: '20px' }}> */}
    <div style={{ width: '50%', height: '400px' }}>
      <Graphin options={{ data: graphData1, layout: { type: 'force' } }} />
    </div>
    <div style={{ width: '50%', height: '400px' }}>
      <Graphin options={{ data: graphData2, layout: { type: 'circular' } }} />
    </div>
    {/* </div> */}


  </div>
}