from invana import InvanaGraph
from invana.ogm import indexes
from invana.ogm.indexes import IndexQueryBuilder
from invana.ogm.fields import StringProperty, FloatProperty, BooleanProperty
from invana.ogm.models import StructuredNode

graph = InvanaGraph("ws://megamind-ws:8182/gremlin", traversal_source="g")


class Project8(StructuredNode):
    graph = graph
    properties = {
        'name': StringProperty(max_length=10, trim_whitespaces=True),
        'description': StringProperty(allow_null=True, min_length=10),
        'rating': FloatProperty(allow_null=True),
        'is_active': BooleanProperty(default=True),
        # 'created_at': DateTimeProperty(default=lambda: datetime.now())
    }
    indexes = (
        indexes.CompositeIndex("name")
    )


index = indexes.CompositeIndex('name')
# query = index.create_index('Person')
query_builder = IndexQueryBuilder()
# index = indexes.CompositeIndex("name")
# query = query_builder.remove_index_query(index.index_name)
response = schema_create.create_model(Project7)

query = query_builder.create_index_query("name", label="Project8")
response = graph.execute_query(query, timeout=3600 * 1000)
print(response.data)

graph.close_connection()
