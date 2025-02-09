import { CanvasEdgeStyle, CanvasNodeStyle, ICanvasEdge, ICanvasNode, ICanvasStyle } from "@invana/data-store";
import { EdgeData, GraphOptions, NodeData } from "@antv/g6";
import { NodeStyle } from "@antv/g6/lib/spec/element/node";
import { DEFAULT_CANVAS_STYLE, DEFAULT_EDGE_STYLE, DEFAULT_NODE_STYLE } from "./defaults";
import { EdgeStyle } from "@antv/g6/lib/spec/element/edge";
import { CanvasManagerOptions } from "./types";
import { CanvasGraphEdge, CanvasGraphNode } from "../types";


export const convert_icanvas_node_to_g6_node = (node: ICanvasNode): NodeData => {

  const { id, type, properties, display } = node;
  const labelField = display?.fields?.labelField;
  const shape = display?.shape;
  return {
    id: id,
    x: node.x ?? 0,
    y: node.y ?? 0,

    type: 'circle', // type ??
    label: properties ? properties[labelField as keyof typeof properties] ?? id : id,
    data: {
      type: type,
      properties: properties,
    },

    style: {
      // size: shape?.size ?? 20,
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
      // iconText: shape?.iconText,
    },
  };

}


export const convert_icanvas_edge_to_g6_edge = (node: ICanvasEdge): EdgeData => {

  const { id, type, properties, display, source, target } = node;

  const labelField = display?.fields;
  console.log("=====labelField", labelField)
  const data: EdgeData = {
    id: id,
    source: source,
    target: target,
    // label: properties[labelField as keyof typeof properties] ?? id,
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
      // iconText: shape?.iconText,
    },
  };

  // data['']
  return data

}

export const convert_node_canvas_style_to_g6_style = (options: CanvasManagerOptions): NodeStyle => {
  /*
  https://g6.antv.antgroup.com/en/api/elements/nodes/base-node#icon-style-icon
  */
  console.log("convert_node_canvas_style_to_g6_style", options);

  const defaultStyle: CanvasNodeStyle = options.styles?.defaultNode || {};
  // const dimLabelFill = theme === 'dark' ? '#232323' : '#cccccc'
  // const dimFill = theme === 'dark' ? '#232323' : '#cccccc';
  const customNodeStyles = options.styles?.nodes || {};

  const g6Style: NodeStyle & { style: any } = {
    type: (d: CanvasGraphNode) => {
      for (const nodeType in customNodeStyles) {
        if (d?.data?.type === nodeType) {
          const customStyle = customNodeStyles[nodeType];
          return customStyle?.shape?.type ?? DEFAULT_NODE_STYLE?.shape?.type
        }
      }
      return DEFAULT_NODE_STYLE?.shape?.type
    },
    // type: defaultStyle.shape?.type ?? DEFAULT_NODE_STYLE?.shape?.type,
    style: {
      // size: (d: CanvasGraphNode) => {
      //   const defaultSize = defaultStyle.shape?.size ?? DEFAULT_NODE_STYLE?.shape?.size ?? undefined;
      //   for (const nodeType in customNodeStyles) {
      //     if (d?.data?.type === nodeType) {
      //       const customStyle = customNodeStyles[nodeType];
      //       return customStyle?.shape?.size ?? defaultSize
      //     }
      //   }
      //   return defaultSize
      // },
      halo: (d: CanvasGraphNode) => {
        const defaultHalo = defaultStyle.shape?.halo ?? DEFAULT_NODE_STYLE?.shape?.halo;
        for (const nodeType in customNodeStyles) {
          if (d?.data?.type === nodeType) {
            const customStyle = customNodeStyles[nodeType];
            return customStyle?.shape?.halo ?? defaultHalo
          }
        }
        return defaultHalo
      },

      labelText: (d: CanvasGraphNode) => {
        for (const nodeType in customNodeStyles) {
          if (d?.data?.type === nodeType) {
            const customStyle = customNodeStyles[nodeType];
            const labelField = customStyle?.fields?.labelField;

            if (!labelField) {
              return d.id;
            }
            // else {
            //   if (labelField.includes("properties.")) {
            //     const propertyFieldName = labelField.split(".")[1];
            //     return d.data.properties.get(propertyFieldName) ?? d.id;
            //   }
            //   return d.data.properties[labelField as keyof typeof d.data.properties] ?? d.id;
            // }
            return customStyle?.shape?.halo ?? d.id
          }
        }
        return d.id
      },// fill
      fill: defaultStyle.shape?.bgColor ?? DEFAULT_NODE_STYLE?.shape?.bgColor,
      fillOpacity: defaultStyle.shape?.bgOpacity ?? DEFAULT_NODE_STYLE?.shape?.bgOpacity,

      // label
      labelPosition: defaultStyle.label?.textPosition ?? DEFAULT_NODE_STYLE?.label?.textPosition,
      labelAutoRotate: defaultStyle.label?.textAutoRotate ?? DEFAULT_NODE_STYLE?.label?.textAutoRotate,
      labelTextColor: defaultStyle.label?.textColor ?? DEFAULT_NODE_STYLE?.label?.textColor,

      // lineWidth: 2,
      stroke: defaultStyle.shape?.borderColor ?? DEFAULT_NODE_STYLE?.shape?.borderColor,
      strokeOpacity: defaultStyle.shape?.borderOpacity ?? DEFAULT_NODE_STYLE?.shape?.borderOpacity,
      // lineStroke: '#D580FF',
      // iconFontFamily: 'iconfont',
      // iconText: '\ue602',
      // iconText: '\uD83E\uDD84'
      // iconText: '✈',
      // iconHeight: 30,
      // iconWidth: 30,
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

  const getNodeSize = (d: CanvasGraphNode) => {
    const defaultSize = defaultStyle.shape?.size ?? DEFAULT_NODE_STYLE?.shape?.size ?? undefined;
    for (const nodeType in customNodeStyles) {
      if (d?.data?.type === nodeType) {
        const customStyle = customNodeStyles[nodeType];
        return customStyle?.shape?.size ?? defaultSize
      }
    }
    return defaultSize
  }
  if (!check_if_node_size_transformer_enabled(options)) {
    g6Style.style.size = getNodeSize;
  }
  console.log("node.g6Style", g6Style);
  return g6Style;
}

export const check_if_node_size_transformer_enabled = (options: CanvasManagerOptions) => {
  return options.transforms?.some(transform => transform.key === 'map-node-size');
}

export const convert_edge_canvas_style_to_g6_sytle = (options: CanvasManagerOptions): EdgeStyle => {
  console.log("convert_edge_canvas_style_to_g6_sytle options", options);
  const defaultStyle: CanvasEdgeStyle = options?.styles?.defaultEdge || {};
  const customEdgeStyles = options.styles?.edges || {};

  // const dimLabelFill = theme === 'dark' ? '#232323' : '#cccccc'
  // const dimStroke = theme === 'dark' ? '#232323' : '#cccccc';
  const g6Style: EdgeStyle = {

    type: (d: CanvasGraphEdge) => {
      for (const edgeType in customEdgeStyles) {
        if (d?.data?.type === edgeType) {
          const customStyle = customEdgeStyles[edgeType];
          return customStyle?.shape?.type ?? DEFAULT_EDGE_STYLE?.shape?.type
        }
      }
      return DEFAULT_EDGE_STYLE.shape?.type
    },

    style: {

      halo: defaultStyle.shape?.halo ?? DEFAULT_EDGE_STYLE.shape?.halo,
      endArrow: true,
      //@ts-ignore
      // labelText: (d) => d.id,
      labelText: (d: CanvasGraphEdge) => {
        for (const edgeType in customEdgeStyles) {
          if (d?.data?.type === edgeType) {
            const customStyle = customEdgeStyles[edgeType];
            const labelField = customStyle?.fields?.labelField;

            if (labelField) {
              if (labelField.includes("properties.")) {
                const propertyFieldName = labelField.split(".")[1];
                return d.data.properties ? d.data.properties[propertyFieldName as keyof typeof d.data.properties] : undefined;
              } else if (labelField === "id") {
                return d.id;
              }
            }
          }
        }

      },// fill
      // stroke
      lineWidth: defaultStyle.shape?.strokeWidth ?? DEFAULT_EDGE_STYLE.shape?.strokeWidth,
      stroke: defaultStyle.shape?.strokeColor ?? DEFAULT_EDGE_STYLE.shape?.strokeColor,

      // label
      labelTextAlign: defaultStyle.label?.textPosition ?? DEFAULT_EDGE_STYLE.label?.textPosition,
      labelAutoRotate: defaultStyle.label?.textAutoRotate ?? DEFAULT_EDGE_STYLE.label?.textAutoRotate,
      labelFill: defaultStyle.label?.textColor ?? DEFAULT_EDGE_STYLE.label?.textColor,

      // opacity
      opacity: defaultStyle.shape?.strokeOpacity ?? DEFAULT_EDGE_STYLE.shape?.strokeOpacity,
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