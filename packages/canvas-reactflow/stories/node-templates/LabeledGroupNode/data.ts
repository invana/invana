export const data = {
  nodes: [
    {
      id: "1",
      position: { x: 200, y: 200 },
      data: { label: "Group Node" },
      width: 380,
      height: 200,
      type: "LabeledGroupNode"
    },
    {
      id: "2",
      position: { x: 50, y: 100 },
      data: { label: "Node" },
      type: "default",
      parentId: "1",
      extent: "parent"
    },
    {
      id: "3",
      position: { x: 200, y: 50 },
      data: { label: "Node" },
      type: "default",
      parentId: "1",
      extent: "parent"
    },
  ],
  edges: []
}