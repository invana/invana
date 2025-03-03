
import { ICanvasData, ICanvasEdge, ICanvasNode } from "@invana/data-store";


export const usersDataSet: ICanvasData = {
  nodes: [
    {
      id: "user1",
      properties: { name: "Alice", age: 30 },
      type: "User",
    },
    {
      id: "user2",
      properties: { name: "Bob" },
      type: "User",
    },
    {
      id: "post1",
      label: "Graphology Guide",
      properties: { title: "Graphology Guide", likes: 100 },
      type: "Post",
    },
  ] as ICanvasNode[],
  edges: [
    {
      id: "user1->user2",
      source: "user1",
      target: "user2",
      type: "Follows",
      properties: { since: 2022 },
    },
    // {
    //   id: "user2->post1",
    //   source: "user2",
    //   target: "post1",
    //   type: "Likes",
    //   properties: { weight: 5 },
    // },
  ] as ICanvasEdge[],
};
