from invana import InvanaGraph
from invana.ogm.fields import StringProperty, DateTimeProperty
from invana.ogm.models import VertexModel, EdgeModel
from datetime import datetime
from invana.ogm import indexes

graph = InvanaGraph("ws://megamind.local:8182/gremlin", traversal_source="g")


class Project171(VertexModel):
    graph = graph
    properties = {
        'name': StringProperty(max_length=10, trim_whitespaces=True),
        'description': StringProperty(allow_null=True, min_length=10),
        'created_at': DateTimeProperty(allow_null=True)
    }
    indexes = (
        indexes.CompositeIndex("name"),
        indexes.MixedIndex("name")
    )


class Authored2(EdgeModel):
    graph = graph
    properties = {
        'created_at': DateTimeProperty(default=lambda: datetime.now())
    }
    indexes = (
        indexes.CompositeIndex("name"),
    )


graph.connector.management.schema_writer.create(Project171)
print(Project171.indexes)
graph.connector.management.extras.rollback_open_transactions(i_understand=True)
graph.connector.management.indexes.create_from_model(Project171)

graph.close()
