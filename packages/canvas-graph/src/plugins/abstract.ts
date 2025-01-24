

export interface ContextMenuBase<T> {
  visible: boolean;
  x: number;
  y: number;
  data: T | null
}