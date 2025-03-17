// Reference https://github.com/wbkd/react-flow/issues/2418
import { generateFieldName } from "../app/utils";
import { StringOrNull } from "../app/types";
import { Node, Edge } from '@xyflow/react'

export const getNextIncomingEdges = (nodeId: string, handleId: StringOrNull, nodes: Node[], edges: Edge[]) => {
  const incomingEdges = edges
    .filter((e) => e.target === nodeId && e.targetHandle === handleId)
    .map((e) => e);
  return incomingEdges;
};

export const getNextOutgoingEdges = (nodeId: string, handleId: StringOrNull, nodes: Node[], edges: Edge[]) => {
  const outgoingEdges = edges
    .filter((e) => e.source === nodeId && e.sourceHandle === handleId)
    .map((e) => e);
  return outgoingEdges;
};


export const HIGHLIGHT_CONSTANTS = {
  HIGHLIGHT_FIELD_CLASSES: ['bg-sky-400', 'text-zinc-900'],
  INACTIVE_FIELD_CLASSES: ['text-zinc-700'],
  EDGE_HIGHLIGHTED_STROKE: '#38bdf8',
  EDGE_INVACTIVE_STROKE: '#222222',
  EDGE_NORMAL_STROKE: '#444444'
}

const getAllIncomers = (
  nodeId: string,
  handleId: StringOrNull,
  nodes: Node[],
  edges: Edge[],
  prevIncomingEdge: Edge[] = []
) => {
  const incomingEdges = getNextIncomingEdges(nodeId, handleId, nodes, edges);
  const result = incomingEdges.reduce((memo: any, inComingEdge: Edge) => {
    memo.push(inComingEdge);
    console.log("inComingEdge", inComingEdge);

    if (prevIncomingEdge.findIndex((n: Edge) => n.id === inComingEdge.target) === -1) {
      prevIncomingEdge.push(inComingEdge);

      getAllIncomers(
        inComingEdge.source,
        inComingEdge.sourceHandle,
        nodes,
        edges,
        prevIncomingEdge
      ).forEach((foundEdge: Edge) => {
        memo.push(foundEdge);

        if (prevIncomingEdge.findIndex((n: Edge) => n.id === foundEdge.id) === -1) {
          prevIncomingEdge.push(inComingEdge);
        }
      });
    }
    return memo;
  }, []);
  return result;
};

const getAllOutgoers = (nodeId: string, handleId: StringOrNull, nodes: Node[], edges: Edge[], prevOutgoers: Edge[] = []) => {
  const outGoingEdges = getNextOutgoingEdges(nodeId, handleId, nodes, edges);
  console.log("====outGoingEdges", outGoingEdges);
  return outGoingEdges.reduce((memo: any, outGoingEdge: Edge) => {
    memo.push(outGoingEdge);
    console.log("====outGoingEdge", outGoingEdge);

    if (prevOutgoers.findIndex((n) => n.id === outGoingEdge.id) === -1) {
      prevOutgoers.push(outGoingEdge);

      getAllOutgoers(
        outGoingEdge.target,
        outGoingEdge.targetHandle,
        nodes,
        edges,
        prevOutgoers
      ).forEach((foundEdge: Edge) => {
        memo.push(foundEdge);

        if (prevOutgoers.findIndex((n) => n.id === foundEdge.id) === -1) {
          prevOutgoers.push(foundEdge);
        }
      });
    }
    return memo;
  }, []);
};

export const getNodeHandles = (edges: Edge[]) => {
  const nodeHandles: string[] = edges
    .map((edge) => {
      if (
        edge.source === edge.sourceHandle ||
        edge.target === edge.targetHandle
      ) {
        // ignore edges that doesnt have real handles
        return [];
      } else {
        return [
          generateFieldName(edge.source, edge.sourceHandle),
          generateFieldName(edge.target, edge.targetHandle)
        ];
      }
    })
    .flat();
  return [...new Set(nodeHandles)];
};

export const highlightHandlePathByNodeHandleId = (
  nodeId: string,
  handleId: StringOrNull,
  nodes: Node[],
  edges: Edge[],
  setNodes: any,
  setEdges: any
) => {
  console.log("highlightHandlePathByNodeHandleId", nodeId, handleId)
  resetHandlePathHighlight(nodes, edges, setNodes, setEdges);
  const allIncomingEdges = getAllIncomers(nodeId, handleId, nodes, edges);
  const allOutgoingEdges = getAllOutgoers(nodeId, handleId, nodes, edges);

  // make all other columns inactive
  document.querySelectorAll(".nodeField").forEach((el) => {
    // el.classList.add("inactive");
    HIGHLIGHT_CONSTANTS.INACTIVE_FIELD_CLASSES.map((cls) => {
      el.classList.add(cls)
    })
  });

  // highlight edges
  const toHighlightEdges = allIncomingEdges.concat(allOutgoingEdges);
  const toHighlightEdgesIds = toHighlightEdges.map((edge: Edge) => edge.id);
  console.log("====toHighlightEdgesIds", toHighlightEdgesIds, edges)
  const edgesHighlighted = edges?.map((edge) => {
    if (toHighlightEdgesIds.includes(edge.id)) {
      edge.animated = true;
      edge.style = {
        ...edge.style,
        // stroke: "lightblue",
        stroke: HIGHLIGHT_CONSTANTS.EDGE_HIGHLIGHTED_STROKE,
        opacity: 1
      };
    } else {
      // edge.hidden = true // 
      edge.style = {
        ...edge.style,
        stroke: HIGHLIGHT_CONSTANTS.EDGE_INVACTIVE_STROKE,
        opacity: 0.4
      };
    }
    return edge;
  });
  setEdges(edgesHighlighted);

  // hightlight current handle when no edges are present
  const toHighlightHandleIds =
    toHighlightEdges.length === 0
      ? [generateFieldName(nodeId, handleId)]
      : getNodeHandles(toHighlightEdges);

  toHighlightHandleIds.forEach((handleId) => {
    console.log("====toHighlightHandleId handleId", handleId)
    const el: HTMLElement | null = document.getElementById(handleId);
    // console.log("====toHighlightHandleId el", el?.id)

    if (el) {
      // el.classList.add("highlight");
      // el.classList.add("bg-white")
      HIGHLIGHT_CONSTANTS.HIGHLIGHT_FIELD_CLASSES.map((cls) => {
        el.classList.add(cls)
      })
      HIGHLIGHT_CONSTANTS.INACTIVE_FIELD_CLASSES.map((cls) => {
        el.classList.remove(cls)
      })
      // el.classList.remove("inactive");
    }
  });
};

export const resetHandlePathHighlight = (nodes: Node[], edges: Edge[], setNodes: any, setEdges: any) => {
  console.log("resetHandlePathHighlight");
  // remove highlighting of all handles
  document.querySelectorAll(".nodeField").forEach((el) => {
    // el.classList.remove("highlight");
    // el.classList.remove("inactive");
    HIGHLIGHT_CONSTANTS.HIGHLIGHT_FIELD_CLASSES.map((cls) => {
      el.classList.remove(cls)
    })
    HIGHLIGHT_CONSTANTS.INACTIVE_FIELD_CLASSES.map((cls) => {
      el.classList.remove(cls)
    })
  });

  // remove edge path hightlights of all handle paths
  const edgesHighlighted = edges?.map((edge) => {
    edge.animated = false;
    edge.style = {
      ...edge.style,
      stroke: HIGHLIGHT_CONSTANTS.EDGE_NORMAL_STROKE,
      opacity: 1
    };
    edge.hidden = false;
    return edge;
  });
  setEdges(edgesHighlighted);
};
