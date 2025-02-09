
export type IColor = string | number;

export interface ICanvasNodeShapeDisplayBase {
  bgColor: IColor;
  bgOpacity: number;
  bgPadding: number;
  borderColor: IColor;
  borderWidth: number;
  borderRadius: number;
  borderOpacity: number;

  dottedBorder: boolean;
  dottedBorderSpacing: number;
}

export interface ICanvasTextDisplay {
  textColor: IColor;
  textFontSize: number;
  textFontWeight: string;
  textFontFamily: string;
  textOpacity: number;
  textPosition: 'top' | 'center' | 'bottom' | 'left' | 'right';
  textAutoRotate: boolean;
}

export interface ICanvasLabelDisplay extends ICanvasNodeShapeDisplayBase, ICanvasTextDisplay { }

export interface ICanvasNodeShapeDisplay extends ICanvasNodeShapeDisplayBase {
  type: 'circle' | 'rect' | 'diamond' | 'hexagon' | 'triangle' | 'star' | string;
  size: number;

  halo: boolean;
  animated: boolean;

  iconFontFamily: string;
  iconText: string;
  iconSrc: string; // for a remote image to load
  // iconColor: IColor;
  // iconSize: number;
  // iconOpacity: number;
  // iconRotate: number;
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
  labelField: string | undefined;
  geoField: string | undefined;
  imageField: string | undefined;
  timestampField: string | undefined;
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

export interface CanvasEdgeStyle {
  shape?: Partial<ICanvasEdgeShapeDisplay>;
  label?: Partial<ICanvasLabelDisplay>;
  fields?: Partial<ICanvaEdgeImportantFields>
}

export type ICanvasTheme = 'light' | 'dark' | 'system' | string;

export interface ICanvasStyle {
  theme?: ICanvasTheme;
  bgColor: IColor;
  colorNodesBy: 'type' | 'defaultColor';
  colorEdgesBy: 'type' | 'sourceNode' | 'targetNode' | 'defaultColor';
  // scaleNode: {
  //   minSize: number;
  //   maxSize: number;
  //   scaleLabel: boolean;
  //   scale: 'linear' | 'log' | 'pow' | 'sqrt';
  // } 
}



