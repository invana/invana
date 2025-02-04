import { CanvasEdgeStyle, CanvasNodeStyle, ICanvasEdge, ICanvasNode } from "@invana/data-store";
import { EdgeData, NodeData } from "@antv/g6";
import { NodeStyle } from "@antv/g6/lib/spec/element/node";
import { defaultEdgeStyle, defaultNodeStyle } from "./defaults";
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

export const convert_node_canvas_style_to_g6_style = (style: CanvasNodeStyle): NodeStyle => {
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
        // lineWidth: 0,
      },
      dim: {
        fill: '#343434',
        labelFill: '#343434',
        // opacity: 0.3
      },
    }
  }
  console.log("node.g6Style", g6Style);

  return g6Style;
}

export const convert_edge_canvas_style_to_g6_sytle = (style: CanvasEdgeStyle): EdgeStyle => {
  const g6Style: EdgeStyle = {
    style: {
      type: style.shape?.type ?? defaultEdgeStyle.shape?.type,
      halo: style.shape?.halo ?? defaultEdgeStyle.shape?.halo,

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
        stroke: '#343434',
        // opacity: 0.3
        labelFill: '#343434',
      }
    },
  }
  console.log("edge.g6Style", g6Style);
  return g6Style
}