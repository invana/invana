
export type IColor = string | number;

export interface ICanvasNodeShapeDisplayBase {
  bgColor: IColor;
  bgOpacity: number;
  bgPadding: number;
  borderColor: IColor;
  BorderWidth: number;
  borderRadius: number;

  dottedBorder: boolean;
  dottedBorderSpacing: number;
}

export interface ICanvasTextDisplay {
  textColor: IColor;
  textFontSize: number;
  textFontWeight: string;
  textFontFamily: string;
  textOpacity: number;
}

export interface ICanvasLabelDisplay extends ICanvasNodeShapeDisplayBase, ICanvasTextDisplay { }

export interface ICanvasNodeShapeDisplay extends ICanvasNodeShapeDisplayBase {
  type: string;
  size: number;
  animated: boolean;

  iconFontFamily: string;
  iconCode: string;
  iconColor: IColor;
  iconSize: number;
  iconOpacity: number;
  iconRotate: number;
}

export interface ICanvasEdgeShapeDisplay {
  strokeColor: IColor;
  strokeWidth: number;
  strokeOpacity: number;
  strokeArrowheadSize: number;
  strokeArrowheadColor: IColor;
  strokeArrowheadOpacity: number;

  animated: boolean;

  dottedBorder: boolean;
  dottedBorderSpacing: number;
}


export interface ICanvasNodeImportantFields {
  labelField: string;
  geoField: string;
  imageField: string;
  timestampField: string;
}
export interface ICanvasNodeDisplay {
  shape?: Partial<ICanvasNodeShapeDisplay>;
  label?: Partial<ICanvasLabelDisplay>;
  fields?: Partial<ICanvasNodeImportantFields>;
  // labelField?: string
}

export interface ICanvaEdgeImportantFields {
  labelField: string;
  timestampField: string;
}

export interface ICanvasEdgeDisplay {
  shape?: Partial<ICanvasEdgeShapeDisplay>;
  label?: Partial<ICanvasLabelDisplay>;
  fields?: ICanvaEdgeImportantFields
}

export interface ICanvasBg {
  bgColor?: IColor;
  pattern?: 'lines' | 'dots' | 'crosses';
  patternColor?: IColor;
}

export interface ICanvasDisplay {
  bg: ICanvasBg;
  theme: 'light' | 'dark' | 'system';
  colorNodesBy: 'type' | 'defaultColor'
  colorEdgeBy: 'type' | 'SourceNode' | 'TargetNode' | 'defaultColor'

}

export interface ICanvasDisplaySettings {
  nodes: ICanvasNodeDisplay[];
  edges: ICanvasEdgeDisplay[];
  canvas: ICanvasDisplay;
  defaultNode: ICanvasNodeDisplay;
  defaultEdge: ICanvasEdgeDisplay;
}

