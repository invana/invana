
import { CanvasNodeStyle, CanvasEdgeStyle, ICanvasStyle } from "@invana/data-store"
import { CanvasManagerOptions, ICanvasStyleOptions } from "./types"
import { getInitialTheme } from "@invana/ui"


export const DEFAULT_NODE_STYLE: CanvasNodeStyle = { // https://g6.antv.antgroup.com/en/examples/element/label/#background
  shape: {
    type: 'circle',
    size: 20,
    halo: true,
    bgColor: '#6a994e',
    bgOpacity: 1
  },
  label: {
    textColor: '#999999',
    textFontSize: 12,
    textPosition: 'top',
    textAutoRotate: true
  },
  fields: {
    labelField: 'id'
  }
}

export const DEFAULT_EDGE_STYLE: CanvasEdgeStyle = {  // https://g6.antv.antgroup.com/en/examples/element/label/#background
  shape: {
    type: 'cubic-vertical',
    halo: false,
    strokeWidth: 1,
    strokeColor: '#cad2c5',
    strokeOpacity: 0.6,
  },
  label: {
    textColor: '#999999',
    textFontSize: 12,
    textPosition: 'center',
    textAutoRotate: true
  },
  fields: {
    labelField: 'id'
  }
}

export const DEFAULT_CANVAS_STYLE: ICanvasStyle = {
  theme: getInitialTheme(),
  bgColor: '#222222',
  colorNodesBy: 'type',
  colorEdgesBy: 'type'
}

export const DEFAULT_STYLE_OPTIONS: ICanvasStyleOptions = {
  defaultNode: DEFAULT_NODE_STYLE,
  defaultEdge: DEFAULT_EDGE_STYLE,
  canvas: DEFAULT_CANVAS_STYLE
}

export const DEFAULT_CANVAS_GRAPH_OPTIONS: CanvasManagerOptions = {
  styles: DEFAULT_STYLE_OPTIONS,
  plugins: [],
  behaviors: [],
  transforms: [],
  layout: undefined

}


// plugins: [{ type: 'background', background: '#fff' }],


