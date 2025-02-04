
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
  textPosition: 'top' | 'center' | 'bottom';
}

export interface ICanvasLabelDisplay extends ICanvasNodeShapeDisplayBase, ICanvasTextDisplay { }

export interface ICanvasNodeShapeDisplay extends ICanvasNodeShapeDisplayBase {
  type: string;
  size: number;

  halo: boolean;
  animated: boolean;

  iconFontFamily: string;
  iconCode: string;
  iconColor: IColor;
  iconSize: number;
  iconOpacity: number;
  iconRotate: number;
}

export interface ICanvasEdgeShapeDisplay {
  type: string;
  halo: boolean;

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
export interface CanvasNodeStyle {
  shape?: Partial<ICanvasNodeShapeDisplay>;
  label?: Partial<ICanvasLabelDisplay>;
  fields?: Partial<ICanvasNodeImportantFields>;
  // labelField?: string
}

export interface ICanvaEdgeImportantFields {
  labelField: string;
  timestampField: string;
}

export interface ICanvasEdgeStyle {
  shape?: Partial<ICanvasEdgeShapeDisplay>;
  label?: Partial<ICanvasLabelDisplay>;
  fields?: Partial<ICanvaEdgeImportantFields>
}


export interface ICanvasStyle {
  theme: 'light' | 'dark' | 'system' | string;
  bgColor: IColor;
  // bgPattern?: 'lines' | 'dots' | 'crosses';
  // bgPatternColor?: IColor;
  colorNodesBy: 'type' | 'defaultColor';
  colorEdgesBy: 'type' | 'sourceNode' | 'targetNode' | 'defaultColor';
}



