
import { CanvasNodeStyle, ICanvasEdgeStyle, ICanvasDisplay } from "@invana/data-store"


export const defaultNodeDisplaySettings: CanvasNodeStyle = { // https://g6.antv.antgroup.com/en/examples/element/label/#background
  shape: {
    type: 'circle',
    size: 20,
    halo: true,
  },
  label: {
    textColor: '#646464',
    textFontSize: 12,
    textPosition: 'top'
  },
  fields: {
    labelField: 'property.name'
  }
}

export const defaultEdgeDisplaySettings: ICanvasEdgeStyle = {  // https://g6.antv.antgroup.com/en/examples/element/label/#background
  shape: {
    type: 'cubic-vertical',
    halo: true,
    strokeWidth: 1,
    strokeColor: '#999999'
  },
  label: {
    textColor: '#646464',
    textFontSize: 12,
    textPosition: 'center'
  },
  fields: {
    labelField: 'property.name'
  }
}

export const defaultCanvasDisplaySettings: ICanvasDisplay = {
  theme: 'dark',
  bgColor: '#222222',
  colorNodesBy: 'type',
  colorEdgesBy: 'type'
}