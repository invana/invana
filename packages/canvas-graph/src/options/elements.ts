import { NodeOptions, EdgeOptions } from "@antv/g6"

export const DEFAULT_NODE_STYLE: NodeOptions = { // https://g6.antv.antgroup.com/en/examples/element/label/#background
  style: {
    halo: true,
    labelText: (d) => d.id,
    labelPosition: 'bottom',
    labelAutoRotate: true,
    // labelTextColor: '#646464',
    fillOpacity: 0.90,
    strokeOpacity: 1

  },
  state: {
    highlight: {
      // fill: '#D580FF',
      halo: true,
      lineWidth: 0,
    },
    dim: {
      fill: '#343434',
    },
  },
  // size: [80, 40],
  // style: {
  //   fill: '#0fbb60',
  //   stroke: '#5B8FF9',
  //   size: 25
  // },
  palette: {
    type: 'group',
    field: 'type',
  },
}

export const DEFAULT_EDGE_STYLE: EdgeOptions = {  // https://g6.antv.antgroup.com/en/examples/element/label/#background
  // type: 'line',
  type: 'cubic-vertical',

  style: {
    // labelText: (d) => {
    //   if (d.id) return d.id
    //   else return d.source + '-' + d.target
    // },
    // labelBackground: true,
    labelTextAlign: 'center',
    // labelTextStroke: 'red',
    labelAutoRotate: true,
    labelBackgroundOpacity: 0.8,
    // labelBackgroundStroke: '#9ec9ff',
    labelFill: '#646464',
    opacity: 0.3,

    endArrow: true,
    // edge: {
    //   style: {
    // stroke: '#343434',
    lineWidth: 1
  },
  state: {
    highlight: {
      lineWidth: 4,
    },
    dim: {
      stroke: '#343434',
    }
  },
  palette: {
    type: 'group',
    field: 'type',
  },
}