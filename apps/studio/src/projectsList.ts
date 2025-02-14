import { lesMiserablesData, flightData, modellingMethodsDataset, processMiningSimpleDataset } from "@invana/example-datasets";
import { Project } from "./store/projectStore";
import { ANTV_DAGRE_LAYOUT } from "@invana/canvas-graph/defaults/layouts";


export const projectsListDataSet: Project[] = [
  {
    id: 'les-miserables-dataset',
    name: 'les miserables dataset',
    description: 'A simple project to demonstrate the power of GraphQL and Apollo Client',
    updated_at: new Date(),
    tags: ['GraphQL', 'Apollo Client', 'React', 'TypeScript'],
    data: lesMiserablesData,
    options: {}
  },
  {
    id: 'flight-data',
    name: 'Flight Data',
    description: 'A simple project to demonstrate the power of GraphQL and Apollo Client',
    updated_at: new Date(),
    tags: ['Rockets', 'Space'],
    data: flightData,
    options: {
      styles: {
        defaultEdge: {
          shape: {
            // type: 'cubic-horizontal',
            // type: 'quadratic'
          }
        }
      }
    }

  },
  {
    id: 'modelling-methods',
    name: 'Modelling Methods',
    description: 'A simple project to demonstrate the power of GraphQL and Apollo Client',
    updated_at: new Date(),
    tags: ['Modelling', 'Methods'],
    data: modellingMethodsDataset,
    options: {
      layout: ANTV_DAGRE_LAYOUT,
      styles: {
        defaultEdge: {
          shape: {
            type: 'cubic-horizontal',
          }
        }
      }
    }
  },
  {
    id: 'event-flow',
    name: 'Process Mining Example',
    description: 'A simple project to demonstrate the power of GraphQL and Apollo Client',
    updated_at: new Date(),
    tags: ['event-flow', 'process-mining'],
    data: processMiningSimpleDataset,
    options: {
      layout: {
        ...ANTV_DAGRE_LAYOUT,
        rankdir: 'TB'
      },

      styles: {
        defaultNode: {
          shape: {
            type: 'rect',
          }
        },
        defaultEdge: {
          shape: {
            strokeOpacity: 0.5,
            type: 'polyline',
          }
        }
      }
    }
  }


]