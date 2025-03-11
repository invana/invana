export const data = {
  "nodes": [
    {
      "id": "1.1",
      "type": "DataFieldsNode",
      "data": {
        "label": "MongoDB (1.1)",
        "fields": [
          {
            "label": "crawlerflow",
            "id": "crawlerflow"
          }
        ]
      },
      "position": {
        "x": -374.97885451264744,
        "y": 287.68869493757217
      }
    },
    {
      "id": "1.2",
      "type": "DataFieldsNode",
      "data": {
        "label": "FileStorage (1.2)",
        "fields": [
          {
            "label": "myfile.csv",
            "id": "myfile-csv",
            "data_type": "string"
          }
        ]
      },
      "position": {
        "x": -376.208293379902,
        "y": 88.51959844232988
      }
    },
    {
      "id": "2.1",
      "type": "DataFieldsNode",
      "data": {
        "label": "NSE Data (2.1)",
        "fields": [
          {
            "label": "identifier",
            "id": "identifier",
            "data_type": "string"
          },
          {
            "label": "is_active",
            "id": "is_active",
            "data_type": "string"
          }
        ]
      },
      "position": {
        "x": -50.406993557437914,
        "y": 331.948494158737
      }
    },
    {
      "id": "2.2",
      "type": "DataFieldsNode",
      "data": {
        "label": "Source1 - Candle Data (2.2)",
        "fields": [
          {
            "label": "candle",
            "id": "candle",
            "data_type": "string"
          },
          {
            "label": "title",
            "id": "title",
            "data_type": "string"
          },
          {
            "label": "description",
            "id": "description",
            "data_type": "string"
          },
          {
            "label": "is_active",
            "id": "is_active",
            "data_type": "bool"
          }
        ]
      },
      "position": {
        "x": -50.406993557437836,
        "y": 49.17755469018326
      }
    },
    {
      "id": "3.1",
      "type": "DataFieldsNode",
      "data": {
        "label": "Derived Data (3.1)",
        "fields": [
          {
            "label": "identifier",
            "id": "identifier",
            "data_type": "string"
          },
          {
            "label": "candle",
            "id": "candle",
            "data_type": "string"
          },
          {
            "label": "title",
            "id": "title",
            "data_type": "string"
          },
          {
            "label": "description",
            "id": "description",
            "data_type": "string"
          }
        ]
      },
      "position": {
        "x": 331.948494158737,
        "y": 179.49807461916893
      }
    },
    {
      "id": "3.2",
      "type": "DataFieldsNode",
      "data": {
        "label": "Derived Data (3.2)",
        "fields": [
          {
            "label": "identifier",
            "id": "identifier",
            "data_type": "string"
          },
          {
            "label": "analysed_field",
            "id": "analysed_field",
            "data_type": "integer"
          }
        ]
      },
      "position": {
        "x": 796.9580873611033,
        "y": 216.08262286679
      }
    }
  ],
  "edges": [
    {
      "id": "e0-1",
      "source": "1.1",
      "sourceHandle": "crawlerflow",
      "target": "2.1",
      "targetHandle": "2.1"
    },
    {
      "id": "e0-2",
      "source": "1.2",
      "sourceHandle": "myfile-csv",
      "target": "2.2",
      "targetHandle": "2.2"
    },
    {
      "id": "e0-3",
      "source": "2.1",
      "sourceHandle": "identifier",
      "target": "3.1",
      "targetHandle": "identifier"
    },
    {
      "id": "e0-4",
      "source": "2.2",
      "sourceHandle": "candle",
      "target": "3.1",
      "targetHandle": "candle"
    },
    {
      "id": "e0-5",
      "source": "2.2",
      "sourceHandle": "title",
      "target": "3.1",
      "targetHandle": "title"
    },
    {
      "id": "e0-6",
      "source": "3.1",
      "sourceHandle": "identifier",
      "target": "3.2",
      "targetHandle": "identifier"
    },
    {
      "id": "e0-7",
      "source": "3.1",
      "sourceHandle": "description",
      "target": "3.2",
      "targetHandle": "analysed_field"
    }
  ],
  "viewport": {
    "x": 413.7305422421646,
    "y": 210.08971667578632,
    "zoom": 0.8133791981321252
  }
}
