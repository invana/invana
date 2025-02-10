import { CanvasGraphPlugin, CanvasGraphBehavior, CanvasGraphTransform } from "./types"


export const getUniqueItemsByItem = (options: CanvasGraphPlugin[] | CanvasGraphBehavior[] | CanvasGraphTransform[]) => {
  const uniqueItems = options.reduce((acc, item) => {
    acc[item.type] = item
    return acc
  }, {} as Record<string, CanvasGraphPlugin | CanvasGraphBehavior | CanvasGraphTransform>)
  return Object.values(uniqueItems)
}