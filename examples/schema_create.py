from invana_py import InvanaGraph
from invana_py.backends.janusgraph.schema import JanusGraphSchemaCreate
from invana_py.ogm.fields import StringProperty, FloatProperty, BooleanProperty, DateTimeProperty
from invana_py.ogm.models import VertexModel
from datetime import datetime

graph = InvanaGraph("ws://megamind-ws:8182/gremlin", traversal_source="g")


class Project3(VertexModel):
    graph = graph
    properties = {
        'name': StringProperty(max_length=10, trim_whitespaces=True),
        'description': StringProperty(allow_null=True, min_length=10),
        'rating': FloatProperty(allow_null=True),
        'is_active': BooleanProperty(default=True),
        # 'created_at': DateTimeProperty(default=lambda: datetime.now())
    }


schema_create = JanusGraphSchemaCreate()
# response = schema_create.create_model(Project3)
# response = Project3.graph.connector.execute_query("graphNames = ConfiguredGraphFactory.getGraphNames();")
# response = Project3.graph.connector.execute_query("graph.features()")
response = Project3.graph.get_features()
print("====response", response.data)

graph.close_connection()
