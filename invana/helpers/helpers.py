from invana.serializer.element_structure import RelationShip, Node
import logging
logger = logging.getLogger(__name__)


def create_indexes_only_from_model(graph, *model_classes, i_understand_rollback=False):
    # TODO - add validations if graph is InvanaGraph instance and model_classes are Model instances 

    for model_class in model_classes:
            if hasattr(model_class, "indexes"):
                if  i_understand_rollback is True:
                    logger.info(f"Found {model_class.indexes.length} indexes on model '{model_class.label_name}'. Creating indexes")
                    graph.connector.management.extras.rollback_open_transactions(i_understand=True)
                    graph.connector.management.indexes.create_from_model(model_class)
                else:
                    # This reason being failures in Janusgraph indexes would cause stalled index status.  
                    raise Exception("Cannot attempt to create indexes when i_understand_rollback=False ")
            else:
                logger.warning(f"""Found no indexes on model '{model_class.label_name}'.
Review your model and create indexes for performance !!""")


def install_models(graph, *model_classes,  i_understand_rollback=False):
    for model_class in model_classes:
        graph.connector.management.schema_writer.create(model_class)
    create_indexes_only_from_model(graph, *model_classes, i_understand_rollback=i_understand_rollback)


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
