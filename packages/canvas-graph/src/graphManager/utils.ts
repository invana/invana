import { ICanvasEdge, ICanvasNode } from "@invana/data-store";
import { EdgeData, NodeData } from "@antv/g6";


export const convert_icanvas_node_to_g6_node = (node: ICanvasNode): NodeData => {

  const { id, type, properties, display } = node;
  const labelField = display?.fields?.labelField;
  const shape = display?.shape;
  return {
    id: id,
    x: node.x || 0,
    y: node.y || 0,

    type: 'circle', // type ||
    label: properties[labelField as keyof typeof properties] || id,
    data: {
      type: type,
      properties: properties,
    },

    style: {
      size: shape?.size || 20,
      // labelText: (d: any) => d[labelField] || id,
      // halo: true,
      // fill: shape?.bgColor,
      // stroke: shape?.borderColor,
      // lineWidth: shape?.BorderWidth,
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
    label: properties[labelField as keyof typeof properties] || id,
    data: {
      type: type,
      properties: properties,
    },

    style: {
      // labelText: (d: any) => d[labelField] || id,
      // fill: shape?.bgColor,
      // stroke: shape?.borderColor,
      // lineWidth: shape?.BorderWidth,
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