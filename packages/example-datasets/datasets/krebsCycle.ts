import { ICanvasData } from "@invana/data-store"

const krebsCycleRaw = {
  "nodes": [
    { "id": "Acetyl-CoA", "name": "Acetyl-CoA" },
    { "id": "Oxaloacetate", "name": "Oxaloacetate" },
    { "id": "Citrate", "name": "Citrate" },
    { "id": "Isocitrate", "name": "Isocitrate" },
    { "id": "Alpha-Ketoglutarate", "name": "Alpha-Ketoglutarate" },
    { "id": "Succinyl-CoA", "name": "Succinyl-CoA" },
    { "id": "Succinate", "name": "Succinate" },
    { "id": "Fumarate", "name": "Fumarate" },
    { "id": "Malate", "name": "Malate" },
    { "id": "Oxaloacetate_final", "name": "Oxaloacetate (final)" }
  ],
  "edges": [
    {
      "from": "Acetyl-CoA",
      "to": "Citrate",
      "reaction": "Acetyl-CoA + Oxaloacetate -> Citrate"
    },
    {
      "from": "Citrate",
      "to": "Isocitrate",
      "reaction": "Citrate -> Isocitrate"
    },
    {
      "from": "Isocitrate",
      "to": "Alpha-Ketoglutarate",
      "reaction": "Isocitrate -> Alpha-Ketoglutarate + CO2 + NADH"
    },
    {
      "from": "Alpha-Ketoglutarate",
      "to": "Succinyl-CoA",
      "reaction": "Alpha-Ketoglutarate -> Succinyl-CoA + CO2 + NADH"
    },
    {
      "from": "Succinyl-CoA",
      "to": "Succinate",
      "reaction": "Succinyl-CoA -> Succinate + ATP/GTP"
    },
    {
      "from": "Succinate",
      "to": "Fumarate",
      "reaction": "Succinate -> Fumarate + FADH2"
    },
    {
      "from": "Fumarate",
      "to": "Malate",
      "reaction": "Fumarate -> Malate"
    },
    {
      "from": "Malate",
      "to": "Oxaloacetate_final",
      "reaction": "Malate -> Oxaloacetate + NADH"
    },
    {
      "from": "Oxaloacetate_final",
      "to": "Acetyl-CoA",
      "reaction": "Oxaloacetate + Acetyl-CoA -> Citrate (Cycle Restart)"
    }
  ]
}


export const krebsCycleDataSet: ICanvasData = {
  nodes: krebsCycleRaw.nodes.map((node: any) => {
    return {
      id: node.id,
      type: 'Compound',
      label: node.name,
      properties: {
        name: node.name
      }
    }
  }
  ),
  edges: krebsCycleRaw.edges.map((edge: any) => {
    return {
      id: edge.from + edge.to,
      type: 'Reaction',
      source: edge.from,
      target: edge.to,
      label: edge.reaction,
      properties: {
        reaction: edge.reaction
      }
    }
  }
  )
}