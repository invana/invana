from invana import InvanaGraph

gremlin_server_url = "ws://megamind.local:8182/gremlin"
graph = InvanaGraph(gremlin_server_url)

from invana.ogm.models import VertexModel, EdgeModel
from invana.ogm.fields import StringProperty, DateTimeProperty, IntegerProperty, FloatProperty, BooleanProperty
from invana.ogm import indexes
from datetime import datetime


class Person(VertexModel):
    graph = graph
    properties = {
        'first_name': StringProperty(max_length=30, trim_whitespaces=True),
        'is_active': BooleanProperty(default=True),
        'created_at': DateTimeProperty(default=lambda: datetime.now())
    }

class Roles(VertexModel):
    graph = graph
    properties = {
        'name': StringProperty()
    }

class Programming(VertexModel):
    graph = graph
    properties = {
        'name': StringProperty(min_length=2, trim_whitespaces=True)
    }
    
class Game(VertexModel):
    graph = graph
    properties = {
        'name': StringProperty(min_length=2, trim_whitespaces=True)
    }
        
class HasSkill(EdgeModel):
    graph = graph
    properties = {
        'created_at': DateTimeProperty(default=lambda: datetime.now())
    }

class HasRole(EdgeModel):
    graph = graph
    properties = {
        'created_at': DateTimeProperty(default=lambda: datetime.now())
    }
    
p = Person.objects.get_or_none(has__first_name="rrmerugu")
# data = graph.connector.vertex.search(has__id=p.id).get_traversal() \
# .bothE("has_skill") \
# .inV().hasLabel("Programming") \
# .path()
# #.toList()defr


data = graph.connector.vertex.getNodeInComingNeighbors(p.id)
for d in data:
    print("===", d.to_json())

graph.close()