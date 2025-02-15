import { Graph } from '@antv/g6';
import { useEffect, useRef, useState } from 'react';
import type { GraphinProps } from '@antv/graphin';


export default function useCanvasGraph<P extends GraphinProps>(props: P) {
  const { onInit, onReady, onDestroy, options } = props;
  const [isReady, setIsReady] = useState(false);
  const graphRef: React.MutableRefObject<Graph | null> = useRef(null);
  const containerRef: React.MutableRefObject<HTMLDivElement | null> = useRef(null);

  useEffect(() => {
    if (graphRef.current || !containerRef.current) return;

    const graph = new Graph({ container: containerRef.current!, ...options });
    graphRef.current = graph;

    setIsReady(true);

    onInit?.(graphRef.current!);

    return () => {
      const graph = graphRef.current;
      if (graph) {
        graph.destroy();
        onDestroy?.();
        graphRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const graph = graphRef.current;

    if (!options || !container || !graph || graph.destroyed) return;

    graph.setOptions(options);
    graph.render().then(() => onReady?.(graph));
  }, [options]);

  return {
    graph: graphRef.current,
    containerRef,
    isReady,
  };
}