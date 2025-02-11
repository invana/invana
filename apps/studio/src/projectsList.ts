import { lesMiserablesData, flightData, modellingMethodsDataset } from "@invana/example-datasets";
import { Project } from "./store/projectStore";


export const projectsListDataSet: Project[] = [
  {
    id: 'les-miserables-dataset',
    name: 'les miserables dataset',
    description: 'A simple project to demonstrate the power of GraphQL and Apollo Client',
    updated_at: new Date(),
    tags: ['GraphQL', 'Apollo Client', 'React', 'TypeScript'],
    data: lesMiserablesData
  },
  {
    id: 'flight-data',
    name: 'Flight Data',
    description: 'A simple project to demonstrate the power of GraphQL and Apollo Client',
    updated_at: new Date(),
    tags: ['Rockets', 'Space'],
    data: flightData
  },
  {
    id: 'modelling-methods',
    name: 'Modelling Methods',
    description: 'A simple project to demonstrate the power of GraphQL and Apollo Client',
    updated_at: new Date(),
    tags: ['Modelling', 'Methods'],
    data: modellingMethodsDataset
  }

]