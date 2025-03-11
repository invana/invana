import { Node, Position } from "@xyflow/react"
import { LayoutDirections } from "./types";


export const computeHandlePositions = (direction: LayoutDirections = "LR") => {
  let sourcePosition: Position;
  let targetPosition: Position;

  if (direction === "LR") {
    sourcePosition = Position.Right;
    targetPosition = Position.Left;
  } else if (direction === "RL") {
    sourcePosition = Position.Left;
    targetPosition = Position.Right;
  } else if (direction === "TB") {
    sourcePosition = Position.Bottom;
    targetPosition = Position.Top;
  } else if (direction === "BT") {
    sourcePosition = Position.Top;
    targetPosition = Position.Bottom;
  } else {
    sourcePosition = Position.Right;
    targetPosition = Position.Left;
  }
  return { sourcePosition, targetPosition }
}


export const addNodeDefaults = (node: Node, nodeDefaults: Partial<Node>, layoutDirection: LayoutDirections = "LR") => {
  const defaultPosition = nodeDefaults?.position;
  const { sourcePosition, targetPosition } = computeHandlePositions(layoutDirection);
  delete nodeDefaults.position;

  return {
    ...node,
    position: {
      x: node.position.x ?? defaultPosition?.x ?? 0,
      y: node.position.y ?? defaultPosition?.y ?? 0,
    },
    sourcePosition: sourcePosition ?? node.sourcePosition,
    targetPosition: targetPosition ?? node.targetPosition,
    ...nodeDefaults
  }
}