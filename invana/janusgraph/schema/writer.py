from ..utils import process_graph_schema_string
from invana.gremlin.schema.writer import GremlinSchemaWriter
from invana.ogm.models import VertexModel, EdgeModel
from invana.serializer.schema_structure import VertexSchema, PropertySchema, EdgeSchema, LinkPath
import logging

logger = logging.getLogger(__name__)


class JanusGraphSchemaCreate(GremlinSchemaWriter):
    """
mgmt.getRelationTypes(PropertyKey.class)
mgmt.getRelationTypes(EdgeLabel.class)
mgmt.getVertexLabels()


    """

    @staticmethod
    def create_model(model: [VertexModel, EdgeModel]):
        query = """mgmt = graph.openManagement()\n"""
        if model.type == "VERTEX":
            label_filter_key = "containsVertexLabel"
            get_label_method = "getVertexLabel"
            make_label_method = "makeVertexLabel"
        elif model.type == "EDGE":
            label_filter_key = "containsEdgeLabel"
            get_label_method = "getEdgeLabel"
            make_label_method = "makeEdgeLabel"
        else:
            raise ValueError("mode should of type vertex or edge")
        query += f"""
if (mgmt.{label_filter_key}('{model.label_name}'))
    {model.label_name} = mgmt.{get_label_method}('{model.label_name}')
else 
    {model.label_name} = mgmt.{make_label_method}('{model.label_name}').make()
""".lstrip("\n")
        for prop_key, prop_model in model.properties.items():
            query += f"""
if (mgmt.containsRelationType('{prop_key}'))
    {prop_key} = mgmt.getPropertyKey('{prop_key}')
else 
    {prop_key} = mgmt.makePropertyKey('{prop_key}').dataType({prop_model.get_data_type_class()}.class).make()
""".lstrip("\n")

        query += f"mgmt.addProperties({model.label_name}, {', '.join(list(model.properties.keys()))})\n"
        query += "mgmt.commit()"
        response = model.graph.connector.execute_query(query)
        return response
