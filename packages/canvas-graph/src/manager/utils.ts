import { CanvasEdgeStyle, CanvasNodeStyle, ICanvasEdge, ICanvasNode, ICanvasStyle } from "@invana/data-store";
import { EdgeData, GraphOptions, NodeData } from "@antv/g6";
import { NodeStyle } from "@antv/g6/lib/spec/element/node";
import { defaultCanvasStyle, defaultEdgeStyle, defaultNodeStyle } from "./defaults";
import { EdgeStyle } from "@antv/g6/lib/spec/element/edge";
import { ICanvasStyleOptions } from "./types";


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
    type: style.shape?.type ?? defaultNodeStyle?.shape?.type,
    style: {
      size: style.shape?.size ?? defaultNodeStyle?.shape?.size,
      halo: style.shape?.halo ?? defaultNodeStyle?.shape?.halo,

      //@ts-ignore
      labelText: (d) => d.id,
      // fill
      fill: style.shape?.bgColor ?? defaultNodeStyle?.shape?.bgColor,
      fillOpacity: style.shape?.bgOpacity ?? defaultNodeStyle?.shape?.bgOpacity,

      // label
      labelPosition: style.label?.textPosition ?? defaultNodeStyle?.label?.textPosition,
      labelAutoRotate: style.label?.textAutoRotate ?? defaultNodeStyle?.label?.textAutoRotate,

      stroke: style.shape?.borderColor ?? defaultNodeStyle?.shape?.borderColor,
      strokeOpacity: style.shape?.borderOpacity ?? defaultNodeStyle?.shape?.borderOpacity,

      labelTextColor: style.label?.textColor ?? defaultNodeStyle?.label?.textColor,
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
      type: style.shape?.type ?? defaultEdgeStyle.shape?.type,
      halo: style.shape?.halo ?? defaultEdgeStyle.shape?.halo,

      //@ts-ignore
      labelText: (d) => d.id,

      // stroke
      lineWidth: style.shape?.strokeWidth ?? defaultEdgeStyle.shape?.strokeWidth,
      stroke: style.shape?.strokeColor ?? defaultEdgeStyle.shape?.strokeColor,

      // label
      labelTextAlign: style.label?.textPosition ?? defaultEdgeStyle.label?.textPosition,
      labelAutoRotate: style.label?.textAutoRotate ?? defaultEdgeStyle.label?.textAutoRotate,
      labelFill: style.label?.textColor ?? defaultEdgeStyle.label?.textColor,

      // opacity
      opacity: style.shape?.strokeOpacity ?? defaultEdgeStyle.shape?.strokeOpacity,

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
    theme: style.theme ?? defaultCanvasStyle.theme,
    background: style.bgColor as string ?? defaultCanvasStyle.bgColor as string,
  }
  // if (style.hasOwnProperty('shape')) {
  //   return convert_node_canvas_style_to_g6_style(style as CanvasNodeStyle);
  // } else {
  //   return convert_edge_canvas_style_to_g6_sytle(style as CanvasEdgeStyle);
  // }
}