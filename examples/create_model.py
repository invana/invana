from invana import InvanaGraph
from invana.ogm.properties import StringProperty, DateTimeProperty
from invana.ogm.models import NodeModel, RelationshipModel
from datetime import datetime
from invana.ogm import indexes

graph = InvanaGraph("ws://megamind-ws:8182/gremlin", traversal_source="g")


class Project171(NodeModel):
    graph = graph
    properties = {
        'name': StringProperty(max_length=10, trim_whitespaces=True),
        'description': StringProperty(allow_null=True, min_length=10),
        'created_at': DateTimeProperty(allow_null=True)
    }
    indexes = (
        indexes.CompositeIndex("created_at"),
        indexes.MixedIndex("created_at")
    )


class Authored2(RelationshipModel):
    graph = graph
    properties = {
        'created_at': DateTimeProperty(default=lambda: datetime.now())
    }
    indexes = (
        indexes.CompositeIndex("name"),
    )


graph.management.create_model(Project171)
print(Project171.indexes)
graph.management.rollback_open_transactions(i_understand=True)
graph.management.create_indexes_from_model(Project171)

graph.close_connection()
