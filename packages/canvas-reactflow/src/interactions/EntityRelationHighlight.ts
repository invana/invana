// Reference https://github.com/wbkd/react-flow/issues/2418
import { generateFieldName } from "../app/utils";
import { StringOrNull } from "../app/types";
import { Node, Edge } from '@xyflow/react'

export const getNextIncomingEdges = (nodeId: string, handleId: StringOrNull, _nodes: Node[], edges: Edge[]) => {
  const incomingEdges = edges
    .filter((e) => e.target === nodeId && e.targetHandle === handleId)
    .map((e) => e);
  return incomingEdges;
};

export const getNextOutgoingEdges = (nodeId: string, handleId: StringOrNull, _nodes: Node[], edges: Edge[]) => {
  const outgoingEdges = edges
    .filter((e) => e.source === nodeId && e.sourceHandle === handleId)
    .map((e) => e);
  return outgoingEdges;
};


export const HIGHLIGHT_CONSTANTS = {
  HIGHLIGHT_FIELD_CLASSES: ['bg-sky-400', 'text-zinc-900'],
  INACTIVE_FIELD_CLASSES: ['text-zinc-700'],
  EDGE_HIGHLIGHTED_STROKE: '#38bdf8',
  EDGE_INVACTIVE_STROKE: '#cccccc',
  EDGE_NORMAL_STROKE: '#999999'
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
  const result = outGoingEdges.reduce((memo: any, outGoingEdge: Edge) => {
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
  return result;
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
          generateFieldName(edge.source, edge.sourceHandle || ''),
          generateFieldName(edge.target, edge.targetHandle || '')
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
  console.log("highlightHandlePathByNodeHandleId", nodeId, handleId, nodes, edges)
  resetHandlePathHighlight(nodes, edges, setNodes, setEdges);
  const allIncomingEdges = getAllIncomers(nodeId, handleId, nodes, edges);
  const allOutgoingEdges = getAllOutgoers(nodeId, handleId, nodes, edges);

  // make all other columns inactive
  document.querySelectorAll(".nodeField").forEach((el) => {
    HIGHLIGHT_CONSTANTS.INACTIVE_FIELD_CLASSES.map((cls) => {
      el.classList.add(cls)
    })
  });

  // highlight edges
  const toHighlightEdges = allIncomingEdges.concat(allOutgoingEdges);
  const toHighlightEdgesIds = toHighlightEdges.map((edge: Edge) => edge.id);
  console.log("====toHighlightEdgesIds", toHighlightEdgesIds, edges)

  // highlight edges of the neighbors
  const updatedEdges = edges.map((edge) => {
    const isHighlighted = toHighlightEdgesIds.includes(edge.id);
    return {
      ...edge,
      animated: isHighlighted,
      style: {
        ...edge.style,
        stroke: isHighlighted
          ? HIGHLIGHT_CONSTANTS.EDGE_HIGHLIGHTED_STROKE
          : HIGHLIGHT_CONSTANTS.EDGE_INVACTIVE_STROKE,
        opacity: isHighlighted ? 1 : 0.4,
        strokeWidth: isHighlighted ? 2 : 1,
      },
    };
  });
  setEdges(updatedEdges); // Pass the updated array directly

  // hightlight current handle when no edges are present
  const toHighlightHandleIds =
    toHighlightEdges.length === 0 && handleId
      ? [generateFieldName(nodeId, handleId)]
      : getNodeHandles(toHighlightEdges);

  // highlight fields
  toHighlightHandleIds.forEach((handleId) => {
    const el: HTMLElement | null = document.getElementById(handleId);
    if (el) {
      HIGHLIGHT_CONSTANTS.HIGHLIGHT_FIELD_CLASSES.map((cls) => {
        el.classList.add(cls)
      })
      HIGHLIGHT_CONSTANTS.INACTIVE_FIELD_CLASSES.map((cls) => {
        el.classList.remove(cls)
      })
    }
  });
};

export const resetHandlePathHighlight = (_nodes: Node[], edges: Edge[], _setNodes: any, setEdges: any) => {
  console.log("resetHandlePathHighlight");
  // remove highlighting of all handles
  document.querySelectorAll(".nodeField").forEach((el) => {
    HIGHLIGHT_CONSTANTS.HIGHLIGHT_FIELD_CLASSES.map((cls) => {
      el.classList.remove(cls)
    })
    HIGHLIGHT_CONSTANTS.INACTIVE_FIELD_CLASSES.map((cls) => {
      el.classList.remove(cls)
    })
  });
  // remove edge path hightlights of all handle paths
  const edgesUnHighlighted = edges?.map((edge) => {
    edge.animated = false;
    edge.style = {
      ...edge.style,
      stroke: HIGHLIGHT_CONSTANTS.EDGE_NORMAL_STROKE,
      strokeWidth: 1,
      opacity: 1
    };
    edge.hidden = false;
    return edge;
  });
  setEdges(edgesUnHighlighted); // Pass the updated array directly
};
