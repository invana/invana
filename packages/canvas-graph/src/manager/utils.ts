import { CanvasEdgeStyle, CanvasNodeStyle, ICanvasEdge, ICanvasNode, ICanvasStyle } from "@invana/data-store";
import { EdgeData, GraphOptions, NodeData } from "@antv/g6";
import { NodeStyle } from "@antv/g6/lib/spec/element/node";
import { DEFAULT_CANVAS_STYLE, DEFAULT_EDGE_STYLE, DEFAULT_NODE_STYLE } from "./defaults";
import { EdgeStyle } from "@antv/g6/lib/spec/element/edge";


export const convert_icanvas_node_to_g6_node = (node: ICanvasNode): NodeData => {

  const { id, type, properties, display } = node;
  const labelField = display?.fields?.labelField;
  const shape = display?.shape;
  return {
    id: id,
    x: node.x ?? 0,
    y: node.y ?? 0,

    type: 'circle', // type ??
    label: properties[labelField as keyof typeof properties] ?? id,
    data: {
      type: type,
      properties: properties,
    },

    style: {
      size: shape?.size ?? 20,
      // labelText: (d: any) => d[labelField] ?? id,
      // halo: true,
      // fill: shape?.bgColor,
      // stroke: shape?.borderColor,
      // lineWidth: shape?.borderWidth,
      // radius: shape?.borderRadius,
      // cursor: 'pointer',
      // fontSize: label?.textFontSize,
      // fontWeight: label?.textFontWeight,
      // fontFamily: label?.textFontFamily,
      // fontOpacity: label?.textOpacity,

      // iconFontFamily: shape?.iconFontFamily,
      // iconText: shape?.iconCode,
    },
  };

}


export const convert_icanvas_edge_to_g6_edge = (node: ICanvasEdge): EdgeData => {

  const { id, type, properties, display, source, target } = node;

  const labelField = display?.fields?.labelField;
  return {
    id: id,
    source: source,
    target: target,
    label: properties[labelField as keyof typeof properties] ?? id,
    data: {
      type: type,
      properties: properties,
    },

    style: {
      // labelText: (d: any) => d[labelField] ?? id,
      // fill: shape?.bgColor,
      // stroke: shape?.borderColor,
      // lineWidth: shape?.borderWidth,
      // radius: shape?.borderRadius,
      // cursor: 'pointer',
      // fontSize: label?.textFontSize,
      // fontWeight: label?.textFontWeight,
      // fontFamily: label?.textFontFamily,
      // fontOpacity: label?.textOpacity,

      // iconFontFamily: shape?.iconFontFamily,
      // iconText: shape?.iconCode,
    },
  };

}

export const convert_node_canvas_style_to_g6_style = (style: CanvasNodeStyle, theme: string): NodeStyle => {

  const dimLabelFill = theme === 'dark' ? '#242424' : '#aaaaaa'
  const dimFill = theme === 'dark' ? '#242424' : '#aaaaaa';

  const g6Style: NodeStyle = {
    type: style.shape?.type ?? DEFAULT_NODE_STYLE?.shape?.type,
    style: {
      size: style.shape?.size ?? DEFAULT_NODE_STYLE?.shape?.size,
      halo: style.shape?.halo ?? DEFAULT_NODE_STYLE?.shape?.halo,

      //@ts-ignore
      labelText: (d) => d.id,
      // fill
      fill: style.shape?.bgColor ?? DEFAULT_NODE_STYLE?.shape?.bgColor,
      fillOpacity: style.shape?.bgOpacity ?? DEFAULT_NODE_STYLE?.shape?.bgOpacity,

      // label
      labelPosition: style.label?.textPosition ?? DEFAULT_NODE_STYLE?.label?.textPosition,
      labelAutoRotate: style.label?.textAutoRotate ?? DEFAULT_NODE_STYLE?.label?.textAutoRotate,

      stroke: style.shape?.borderColor ?? DEFAULT_NODE_STYLE?.shape?.borderColor,
      strokeOpacity: style.shape?.borderOpacity ?? DEFAULT_NODE_STYLE?.shape?.borderOpacity,

      labelTextColor: style.label?.textColor ?? DEFAULT_NODE_STYLE?.label?.textColor,
    },
    state: {
      highlight: {
        // fill: '#D580FF',
        halo: true,
        lineWidth: 0,
      },
      dim: {
        fill: dimFill,
        labelFill: dimLabelFill
      },
    },
    palette: {
      type: 'group',
      field: 'type',
    },
  }
  console.log("node.g6Style", g6Style);

  return g6Style;
}

export const convert_edge_canvas_style_to_g6_sytle = (style: CanvasEdgeStyle, theme: string): EdgeStyle => {
  const dimLabelFill = theme === 'dark' ? '#242424' : '#aaaaaa'
  const dimStroke = theme === 'dark' ? '#242424' : '#aaaaaa';

  const g6Style: EdgeStyle = {
    style: {
      type: style.shape?.type ?? DEFAULT_EDGE_STYLE.shape?.type,
      halo: style.shape?.halo ?? DEFAULT_EDGE_STYLE.shape?.halo,

      //@ts-ignore
      labelText: (d) => d.id,

      // stroke
      lineWidth: style.shape?.strokeWidth ?? DEFAULT_EDGE_STYLE.shape?.strokeWidth,
      stroke: style.shape?.strokeColor ?? DEFAULT_EDGE_STYLE.shape?.strokeColor,

      // label
      labelTextAlign: style.label?.textPosition ?? DEFAULT_EDGE_STYLE.label?.textPosition,
      labelAutoRotate: style.label?.textAutoRotate ?? DEFAULT_EDGE_STYLE.label?.textAutoRotate,
      labelFill: style.label?.textColor ?? DEFAULT_EDGE_STYLE.label?.textColor,

      // opacity
      opacity: style.shape?.strokeOpacity ?? DEFAULT_EDGE_STYLE.shape?.strokeOpacity,

    },
    state: {
      highlight: {
        lineWidth: 4,
      },
      dim: {
        stroke: dimStroke,
        labelFill: dimLabelFill,
        // opacity: 0.3
      }
    },
    palette: {
      type: 'group',
      field: 'type',
    },
  }
  console.log("edge.g6Style", g6Style);
  return g6Style
}

export const convert_canvas_style_to_g6_style = (style: ICanvasStyle): Partial<GraphOptions> => {

  return {
    theme: style.theme ?? DEFAULT_CANVAS_STYLE.theme,
    // autoResize: true,
    // autoFit: 'view', // 'view' | 'graph' | 'center'
    // animation: false,
    // background: style.bgColor as string ?? DEFAULT_CANVAS_STYLE.bgColor as string,
  }
  // if (style.hasOwnProperty('shape')) {
  //   return convert_node_canvas_style_to_g6_style(style as CanvasNodeStyle);
  // } else {
  //   return convert_edge_canvas_style_to_g6_sytle(style as CanvasEdgeStyle);
  // }
}