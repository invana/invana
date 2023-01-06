from invana.serializer.element_structure import RelationShip, Node


def get_vertex_properties_of_edges(edges, graph):
    """
    TODO - move this to gremlin
    By default, edge json will not have inv and outv properties,
    this method will fetch and stitch the fill vertex details to the edge inv and outv
    """

    vertex_ids = []
    for edge in edges:
        if not isinstance(edge, RelationShip):
            raise Exception("relationship data should be RelationShip type")
        vertex_ids.append(edge.inv.id)
        vertex_ids.append(edge.outv.id)
    unique_vertex_ids = list(set(vertex_ids))
    vertex_instances = graph.vertex.search(
        has__id__within=unique_vertex_ids).to_list()

    vertices_dict = dict([(v.id, v) for v in vertex_instances])
    for edge in edges:
        edge.inv_back = edge.inv
        edge.inv = vertices_dict[edge.inv.id]
        edge.outv_back = edge.outv
        edge.outv = vertices_dict[edge.outv.id]
    return edges
