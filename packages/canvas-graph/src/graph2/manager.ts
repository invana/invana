import { Graph, GraphOptions } from '@antv/g6';



export class GraphManager {

  constructor(graph: Graph, options: GraphOptions) {
    console.log("GraphManager constructor called", graph, options)
  }

  setTheme(theme: string) {
    console.log("setTheme called", theme)
  }


  setLayout(layout: string) {
    console.log("setLayout called", layout)
  }

  setDisplay(mode: string) {
    console.log("setDisplay called", mode)
  }



}