export const data = {
  nodes: [{
    id: "2.1",
    type: "DataFieldsNode",
    data: {
      label: "NSE Data (2.1)",
      fields: [
        { label: "identifier", id: "identifier", data_type: "string" },
        { label: "is_active", id: "is_active", data_type: "string" }
      ]
    },
    position: { x: -300, y: 0 }
  },
  {
    id: "2.2",
    type: "DataFieldsNode",
    data: {
      label: "Source1 - Candle Data (2.2)",
      fields: [
        { label: "candle", id: "candle", data_type: "string" },
        { label: "title", id: "title", data_type: "string" },
        { label: "description", id: "description", data_type: "string" },
        { label: "is_active", id: "is_active", data_type: "bool" }
      ]
    },
    position: { x: 100, y: 0 }
  }],
  edges: []
}
