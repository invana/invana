
import { CanvasNodeStyle, CanvasEdgeStyle, ICanvasStyle } from "@invana/data-store"
import { ICanvasStyleOptions } from "./types"
import { getInitialTheme } from "@invana/ui"


export const defaultNodeStyle: CanvasNodeStyle = { // https://g6.antv.antgroup.com/en/examples/element/label/#background
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

export const defaultEdgeStyle: CanvasEdgeStyle = {  // https://g6.antv.antgroup.com/en/examples/element/label/#background
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

export const defaultCanvasStyle: ICanvasStyle = {
  theme: getInitialTheme(),
  bgColor: '#222222',
  colorNodesBy: 'type',
  colorEdgesBy: 'type'
}

export const defaultStyleOptions: ICanvasStyleOptions = {
  defaultNode: defaultNodeStyle,
  defaultEdge: defaultEdgeStyle,
  canvas: defaultCanvasStyle
}