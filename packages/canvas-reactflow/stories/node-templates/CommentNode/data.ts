export const data = {
  "nodes": [
    {
      "id": "1a",
      "type": "GenericNode",
      "data": {
        "label": "Node 1"
      },
      "position": {
        "x": -12.573526398498714,
        "y": -103.58190794953691
      },
      "measured": {
        "width": 150,
        "height": 40
      },
      "selected": false,
      "dragging": false
    },
    {
      "id": "1b",
      "position": {
        "x": -187.29621805692835,
        "y": -45.90756388614321
      },
      "parentId": "1a",
      "type": "CommentNode",
      "data": {
        "label": "CommentNode 1",
        "commentText": "Hello World ! this is yet another attempt to create beautiful visualisations"
      },
      "measured": {
        "width": 180,
        "height": 82
      },
      "selected": false,
      "dragging": false
    },
    {
      "id": "2a",
      "data": {
        "label": "Node 2"
      },
      type: "GenericNode",
      "position": {
        "x": -176.03989774330168,
        "y": 125.9873935230946
      },
      "measured": {
        "width": 150,
        "height": 40
      },
      "selected": true,
      "dragging": false
    },
    {
      "id": "3a",
      type: "GenericNode",
      "data": {
        "label": "Node 3"
      },
      "position": {
        "x": 178.43485515253954,
        "y": 125.38865417078514
      },
      "measured": {
        "width": 150,
        "height": 40
      },
      "selected": false,
      "dragging": false
    },
    {
      "id": "3b",
      "position": {
        "x": 91.15546849838367,
        "y": -106.783611580023
      },
      "parentId": "3a",
      "type": "CommentNode",
      "data": {
        "label": "CommentNode 2",
        "commentText": "<strong>Hello World !</strong> this is yet another attempt to create beautiful visualisations.  This is also just a node 🥳"
      },
      "measured": {
        "width": 180,
        "height": 98
      },
      "selected": false,
      "dragging": false
    }
  ],
  "edges": [
    {
      "id": "e1-2",
      "source": "1a",
      "target": "2a"
    },
    {
      "id": "e1-3",
      "source": "1a",
      "target": "3a"
    }
  ]
}