import React, {
  useState,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import { Graphin } from '@antv/graphin';
import { Graph } from '@antv/g6'
import { CanvasManager } from "../manager";
import { mergeDeep } from '@invana/data-store';
import { getUniqueItemsByItem } from '../manager/utils';
import { CanvasManagerOptions } from '../manager/types';
import { DEFAULT_CANVAS_GRAPH_OPTIONS } from '../manager/defaults';
import { CanvasToolBar } from '../plugins';
import { CanvasGraphProps } from './types';



export const CanvasGraph: React.FC<CanvasGraphProps> = ((props) => {
  const [isGraphReady, setIsGraphReady] = useState(false);
  const localRef = useRef<Graph | null>(null);
  const canvasManagerRef = useRef<CanvasManager | null>(null);
  const showHeader = props.showHeader ?? false;



  const options: CanvasManagerOptions = useMemo(() => {
    const optionsData = mergeDeep(DEFAULT_CANVAS_GRAPH_OPTIONS, props.options ?? {});

    if (optionsData.transforms) {
      optionsData['transforms'] = getUniqueItemsByItem(optionsData.transforms || [])
    }

    if (optionsData.plugins) {
      optionsData['plugins'] = getUniqueItemsByItem(optionsData.plugins || [])
    }

    if (optionsData.behaviors) {
      optionsData['behaviors'] = getUniqueItemsByItem(optionsData.behaviors || [])
    }
    return optionsData
  }, [props.options]);

  const initData = useMemo(() => {
    return props.initData ?? { 'nodes': [], 'edges': [] };
  }, [props.initData]);

  const onReady = useCallback((graph: Graph) => {
    console.log("Graphin onReady", graph);
    const canvasManager: CanvasManager = new CanvasManager(graph, options);
    canvasManager.store.addData(initData, () => canvasManager.render());
    props?.onReady?.(canvasManager);
    canvasManagerRef.current = canvasManager;
    setIsGraphReady(true);
  }, [options, initData, props]);

  const onDestroy = useCallback(() => {
    console.log("Graphin onDestroy");
    props?.onDestroy?.();
  }, [props]);

  console.log("CanvasGraph loaded", props.graphName, options.plugins?.length, options);
  return (
    <div className='h-full w-full bg-background' style={props.containerStyle ?? {}}>

      {
        isGraphReady && showHeader && <CanvasToolBar className='h-50 bg-background text-foreground' getCanvasManager={() => canvasManagerRef.current as CanvasManager} />
      }
      <Graphin
        key={props?.graphName}
        ref={localRef}
        options={options}
        onReady={onReady}
        onDestroy={onDestroy}
      />
    </div>
  );
});

