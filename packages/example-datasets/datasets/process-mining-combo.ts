import { ICanvasData, ICanvasEdge, ICanvasNode } from "@invana/data-store";



export const processMiningComboDataset: ICanvasData = {
  "nodes": [
    {
      "id": "0",
      "type": "node",
      "label": "Node 0",
      "properties": {}
    },
    {
      "id": "1",
      "type": "node",
      "label": "Node 1",
      "properties": {}
    },
    {
      "id": "2",
      "type": "node",
      "label": "Node 2",
      "properties": {}
    },
    {
      "id": "3",
      "type": "node",
      "label": "Node 3",
      "properties": {}
    },
    {
      "id": "4",
      "combo": "A",
      "type": "node",
      "label": "Node 4",
      "properties": {}
    },
    {
      "id": "5",
      "combo": "B",
      "type": "node",
      "label": "Node 5",
      "properties": {}
    },
    {
      "id": "6",
      "combo": "A",
      "type": "node",
      "label": "Node 6",
      "properties": {}
    },
    {
      "id": "7",
      "combo": "C",
      "type": "node",
      "label": "Node 7",
      "properties": {}
    },
    {
      "id": "8",
      "combo": "C",
      "type": "node",
      "label": "Node 8",
      "properties": {}
    },
    {
      "id": "9",
      "combo": "A",
      "type": "node",
      "label": "Node 9",
      "properties": {}
    },
    {
      "id": "10",
      "combo": "B",
      "type": "node",
      "label": "Node 10",
      "properties": {}
    },
    {
      "id": "11",
      "combo": "B",
      "type": "node",
      "label": "Node 11",
      "properties": {}
    }
  ] as ICanvasNode[],
  "edges": [
    {
      "id": "edge-102",
      "source": "0",
      "target": "1",
      "type": "edge",
      "label": "Edge 102",
      "properties": {}
    },
    {
      "id": "edge-161",
      "source": "0",
      "target": "2",
      "type": "edge",
      "label": "Edge 161",
      "properties": {}
    },
    {
      "id": "edge-237",
      "source": "1",
      "target": "4",
      "type": "edge",
      "label": "Edge 237",
      "properties": {}
    },
    {
      "id": "edge-253",
      "source": "0",
      "target": "3",
      "type": "edge",
      "label": "Edge 253",
      "properties": {}
    },
    {
      "id": "edge-133",
      "source": "3",
      "target": "4",
      "type": "edge",
      "label": "Edge 133",
      "properties": {}
    },
    {
      "id": "edge-320",
      "source": "2",
      "target": "5",
      "type": "edge",
      "label": "Edge 320",
      "properties": {}
    },
    {
      "id": "edge-355",
      "source": "1",
      "target": "6",
      "type": "edge",
      "label": "Edge 355",
      "properties": {}
    },
    {
      "id": "edge-823",
      "source": "1",
      "target": "7",
      "type": "edge",
      "label": "Edge 823",
      "properties": {}
    },
    {
      "id": "edge-665",
      "source": "3",
      "target": "8",
      "type": "edge",
      "label": "Edge 665",
      "properties": {}
    },
    {
      "id": "edge-884",
      "source": "3",
      "target": "9",
      "type": "edge",
      "label": "Edge 884",
      "properties": {}
    },
    {
      "id": "edge-536",
      "source": "5",
      "target": "10",
      "type": "edge",
      "label": "Edge 536",
      "properties": {}
    },
    {
      "id": "edge-401",
      "source": "5",
      "target": "11",
      "type": "edge",
      "label": "Edge 401",
      "properties": {}
    }
  ] as ICanvasEdge[],
  "combos": [
    {
      "id": "A",
      "style": {
        "type": "rect"
      },
      "type": "combo",
      "label": "Combo A",
      "properties": {}
    },
    {
      "id": "B",
      "display": {
        "shape": {
          type: "circle"
        }
      },
      "type": "combo",
      "label": "Combo B",
      "properties": {}
    },
    {
      "id": "C",
      "display": {
        "shape": {
          type: "circle"
        }
      },
      "type": "combo",
      "label": "Combo C",
      "properties": {}
    }
  ] as ICanvasNode[]
}