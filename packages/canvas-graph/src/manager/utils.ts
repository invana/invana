import { CanvasEdgeStyle, CanvasNodeStyle, ICanvasEdge, ICanvasNode, ICanvasStyle, mergeDeep } from "@invana/data-store";
import { EdgeData, GraphOptions, NodeData } from "@antv/g6";
import { NodeStyle } from "@antv/g6/lib/spec/element/node";
import { DEFAULT_CANVAS_STYLE, DEFAULT_EDGE_STYLE, DEFAULT_NODE_STYLE } from "./defaults";
import { EdgeStyle } from "@antv/g6/lib/spec/element/edge";
import { CanvasManagerOptions, ICanvasStyleOptions } from "./types";
import { CanvasGraphEdge, CanvasGraphNode } from "../types";


export const convert_icanvas_node_to_g6_node = (node: ICanvasNode): NodeData => {
  const { id, type, properties, display } = node;
  // const labelField = display?.fields?.labelField;
  // const shape = display?.shape;
  return {
    id: id,
    x: node.x ?? 0,
    y: node.y ?? 0,
    type: 'circle', // type ??
    label: node.label,
    // label: properties ? properties[labelField as keyof typeof properties] ?? id : id,
    data: {
      type: type,
      properties: properties,
    }
  };
}


export const convert_icanvas_edge_to_g6_edge = (edge: ICanvasEdge): EdgeData => {
  const { id, type, properties, display, source, target } = edge;
  // const labelField = display?.fields;
  // console.log("=====labelField", labelField)
  const data: EdgeData = {
    id: id,
    source: source,
    target: target,
    label: edge.label,
    // label: properties[labelField as keyof typeof properties] ?? id,
    data: {
      type: type,
      properties: properties,
    }
  };
  return data
}

export const do_style_override = (d: CanvasGraphNode | CanvasGraphEdge,
  fieldName: string,
  dataType: 'shape' | 'label' | 'state',
  customNodeStyles: ICanvasStyleOptions['nodes'] | ICanvasStyleOptions['edges'],
  defaultValue: undefined | any) => {
  /*

  */
  for (const nodeType in customNodeStyles) {
    if (d?.data?.type === nodeType) {
      const customStyle = customNodeStyles[nodeType];
      if (dataType === 'shape') {
        return customStyle?.shape?.[fieldName as keyof typeof customStyle.shape] ?? defaultValue
      } else if (dataType === 'label') {
        return customStyle?.label?.[fieldName as keyof typeof customStyle.label] ?? defaultValue
      }
      // else if (dataType === 'state') {
      //   return customStyle?.state?.[fieldName as keyof typeof customStyle.state] ?? defaultValue
      // }
    }
  }
  return defaultValue
}

export const generateElementLabel = (
  d: CanvasGraphNode | CanvasGraphEdge,
  customNodeStyles: ICanvasStyleOptions['nodes'] | ICanvasStyleOptions['edges'],
  defaultValue: any) => {

  if (d.label) {
    console.log("=====generateElementLabel d.label", d.label)
    return d.label;
  }

  for (const nodeType in customNodeStyles) {
    if (d?.data?.type === nodeType) {
      const customStyle = customNodeStyles[nodeType];
      const labelField = customStyle?.fields?.labelField;
      console.log("=====customStyle", nodeType, labelField)

      if (labelField) {
        if (labelField.includes("properties.")) {
          const propertyFieldName = labelField.split(".")[1];
          //@ts-ignore,
          return d.data.properties && propertyFieldName ? d.data.properties[propertyFieldName as keyof typeof d.data.properties] : undefined;
        } else if (labelField === "id") {
          return d.id;
        }
      }
    }
  }
  return defaultValue
}

export const convert_node_canvas_style_to_g6_style = (options: CanvasManagerOptions): NodeStyle => {
  /*
  https://g6.antv.antgroup.com/en/api/elements/nodes/base-node#icon-style-icon
  */
  console.log("convert_node_canvas_style_to_g6_style", options);

  const defaultStyle: CanvasNodeStyle = mergeDeep(DEFAULT_NODE_STYLE, options.styles?.defaultNode || {});
  // const dimLabelFill = theme === 'dark' ? '#232323' : '#cccccc'
  // const dimFill = theme === 'dark' ? '#232323' : '#cccccc';
  const customNodeStyles = options.styles?.nodes || {};
  const g6Style: NodeStyle & { style: any } = {
    type: (d: CanvasGraphNode) => do_style_override(d, 'type', 'shape', customNodeStyles, defaultStyle?.shape?.type),
    style: {
      halo: (d: CanvasGraphNode) => do_style_override(d, 'halo', 'shape', customNodeStyles, defaultStyle?.shape?.halo),
      labelText: (d: CanvasGraphNode) => generateElementLabel(d, customNodeStyles, d.id),// fill
      fill: (d: CanvasGraphNode) => do_style_override(d, 'bgColor', 'shape', customNodeStyles, defaultStyle?.shape?.bgColor),
      fillOpacity: (d: CanvasGraphNode) => do_style_override(d, 'bgOpacity', 'shape', customNodeStyles, defaultStyle?.shape?.bgOpacity),
      // label
      labelPosition: (d: CanvasGraphNode) => do_style_override(d, 'textPosition', 'label', customNodeStyles, defaultStyle?.label?.textPosition),
      labelAutoRotate: (d: CanvasGraphNode) => do_style_override(d, 'textAutoRotate', 'label', customNodeStyles, defaultStyle?.label?.textAutoRotate),
      labelTextColor: (d: CanvasGraphNode) => do_style_override(d, 'textColor', 'label', customNodeStyles, defaultStyle?.label?.textColor),
      // lineWidth: 2,
      // stroke: defaultStyle.shape?.borderColor ?? defaultStyle?.shape?.borderColor,
      stroke: (d: CanvasGraphNode) => do_style_override(d, 'borderColor', 'shape', customNodeStyles, defaultStyle?.shape?.borderColor),
      strokeOpacity: defaultStyle.shape?.borderOpacity ?? defaultStyle?.shape?.borderOpacity,
      // lineStroke: '#D580FF',
      iconFontFamily: (d: CanvasGraphNode) => do_style_override(d, 'iconFontFamily', 'shape', customNodeStyles, undefined),
      iconText: (d: CanvasGraphNode) => do_style_override(d, 'iconText', 'shape', customNodeStyles, undefined),
      iconSrc: (d: CanvasGraphNode) => do_style_override(d, 'iconSrc', 'shape', customNodeStyles, undefined),

    },
    // https://g6.antv.antgroup.com/en/manual/core-concept/state#state-type
    state: {
      highlight: {
        // fill: '#D580FF',
        halo: true,
        lineWidth: 2,
        lineStroke: '#D580FF',
      },
      dim: {
        fillOpacity: 0.1,
        labelFillOpacity: 0.1,
        lineWidth: 0,
        // fill: dimFill,
        // labelFill: dimLabelFill
      }
    }
  };

  if (!check_if_node_size_transformer_enabled(options)) {
    // g6Style.style.size = getNodeSize;
    g6Style.style.size = (d: CanvasGraphNode) => do_style_override(d, 'size', 'shape', customNodeStyles, defaultStyle?.shape?.size)
    // if (g6Style.style.iconSrc) {
    //   // g6Style.style.iconHeight = (d: CanvasGraphNode) => do_style_override(d, 'size', 'shape', customNodeStyles, defaultStyle?.shape?.size)
    //   // g6Style.style.iconWidth = (d: CanvasGraphNode) => do_style_override(d, 'size', 'shape', customNodeStyles, defaultStyle?.shape?.size)
    // }
  }

  // if (g6Style.style.type) {
  //   g6Style.style.iconClip = (d: CanvasGraphNode) => {
  //     if (g6Style.style.type(d) === 'circle') {
  //       return {
  //         r: 50,
  //       };
  //     }
  //     return false;
  //   };
  // }


  console.log("node.g6Style", g6Style);
  return g6Style;
}

export const check_if_node_size_transformer_enabled = (options: CanvasManagerOptions) => {
  return options.transforms?.some(transform => transform.key === 'map-node-size');
}

export const convert_edge_canvas_style_to_g6_sytle = (options: CanvasManagerOptions): EdgeStyle => {
  console.log("convert_edge_canvas_style_to_g6_sytle options", options);
  const defaultStyle: CanvasEdgeStyle = mergeDeep(DEFAULT_EDGE_STYLE, options?.styles?.defaultEdge || {});
  const customEdgeStyles = options.styles?.edges || {};
  const g6Style: EdgeStyle = {
    type: (d: CanvasGraphEdge) => do_style_override(d, 'type', 'shape', customEdgeStyles, defaultStyle?.shape?.type),
    style: {
      halo: (d: CanvasGraphEdge) => do_style_override(d, 'halo', 'shape', customEdgeStyles, defaultStyle?.shape?.halo),
      endArrow: true,

      labelText: (d: CanvasGraphNode) => generateElementLabel(d, customEdgeStyles, undefined),// fill

      // labelText: (d: CanvasGraphEdge) => {
      //   for (const edgeType in customEdgeStyles) {
      //     if (d?.data?.type === edgeType) {
      //       const customStyle = customEdgeStyles[edgeType];
      //       const labelField = customStyle?.fields?.labelField;

      //       if (labelField) {
      //         if (labelField.includes("properties.")) {
      //           const propertyFieldName = labelField.split(".")[1];
      //           //@ts-ignore
      //           return d.data.properties ? d.data.properties[propertyFieldName as keyof typeof d.data.properties] : undefined;
      //         } else if (labelField === "id") {
      //           return d.id;
      //         }
      //       }
      //     }
      //   }
      //   return
      // },// fill
      // stroke
      lineWidth: (d: CanvasGraphEdge) => do_style_override(d, 'strokeWidth', 'shape', customEdgeStyles, defaultStyle?.shape?.strokeWidth),
      stroke: (d: CanvasGraphEdge) => do_style_override(d, 'strokeColor', 'shape', customEdgeStyles, defaultStyle?.shape?.strokeColor),
      opacity: (d: CanvasGraphEdge) => do_style_override(d, 'strokeOpacity', 'label', customEdgeStyles, defaultStyle?.shape?.strokeOpacity),

      // label
      labelTextAlign: (d: CanvasGraphEdge) => do_style_override(d, 'textPosition', 'label', customEdgeStyles, defaultStyle?.label?.textPosition),
      labelAutoRotate: (d: CanvasGraphEdge) => do_style_override(d, 'labelAutoRotate', 'label', customEdgeStyles, defaultStyle?.label?.textAutoRotate),
      labelFill: (d: CanvasGraphEdge) => do_style_override(d, 'textColor', 'label', customEdgeStyles, defaultStyle?.label?.textColor),
    },
    state: {
      highlight: {
        lineWidth: 4,
        opacity: 0.7,
      },
      dim: {
        // stroke: dimStroke,
        opacity: 0.1,
        labelFillOpacity: 0.1,
        // labelFill: dimLabelFill,
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
    autoResize: false,
    autoFit: 'view', // 'view' | 'graph' | 'center'
    animation: {
      duration: 200,
      easing: 'linear',
    }
    // background: style.bgColor as string ?? DEFAULT_CANVAS_STYLE.bgColor as string,
  }
  // if (style.hasOwnProperty('shape')) {
  //   return convert_node_canvas_style_to_g6_style(style as CanvasNodeStyle);
  // } else {
  //   return convert_edge_canvas_style_to_g6_sytle(style as CanvasEdgeStyle);
  // }
}