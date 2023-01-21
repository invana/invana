from invana import InvanaGraph
from invana.ogm.fields import StringProperty, DateTimeProperty
from invana.ogm.models import VertexModel, EdgeModel
from datetime import datetime
from invana.ogm import indexes

graph = InvanaGraph("ws://megamind.local:8182/gremlin")


class Project(VertexModel):
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


class Authored(EdgeModel):
    graph = graph
    properties = {
        'created_at': DateTimeProperty(default=lambda: datetime.now())
    }
    indexes = (
        indexes.CompositeIndex("name"),
    )


def create_indexes(*model_classes):
    for model_class in model_classes:
        graph.connector.management.schema_writer.create(model_class)
        print(model_class.indexes)
        graph.connector.management.extras.rollback_open_transactions(i_understand=True)
        graph.connector.management.indexes.create_from_model(model_class)
    graph.close()

create_indexes(Project, Authored)