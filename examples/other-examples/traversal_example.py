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
    
p = Person.objects.create(first_name="rrmerugu")
print(p.id)


create_data = True

if create_data is True:
    Person.objects.delete()
    Programming.objects.delete()
    Game.objects.delete()
    HasSkill.objects.delete()
    HasRole.objects.delete()

    p = Person.objects.create(first_name="rrmerugu")

    _, django = Programming.objects.get_or_create(name="Django")
    _, python = Programming.objects.get_or_create(name="Python")
    _, neo4j = Programming.objects.get_or_create(name="neo4j")
    _, janusgraph = Programming.objects.get_or_create(name="Janusgraph")

    HasSkill.objects.get_or_create(p.id, django.id)
    HasSkill.objects.get_or_create(p.id, python.id)
    HasSkill.objects.get_or_create(p.id, neo4j.id)
    HasSkill.objects.get_or_create(p.id, janusgraph.id)

    _, cod = Game.objects.get_or_create(name="Call of Duty")
    _, fifa = Game.objects.get_or_create(name="Fifa")

    HasSkill.objects.get_or_create(p.id, cod.id)
    HasSkill.objects.get_or_create(p.id, fifa.id)


    _, dev_role = Roles.objects.get_or_create(name="Developer")
    _, admin_role = Roles.objects.get_or_create(name="Admin")

    HasRole.objects.get_or_create(p.id, dev_role.id)
    HasRole.objects.get_or_create(p.id, admin_role.id)


    print("Created data")

from gremlin_python.process.graph_traversal import __

p = Person.objects.get_or_none(has__first_name="rrmerugu")
print("person", p)
skills = graph.connector.vertex.search(has__id=p.id).traverse_through("has_skill").toList()
print("skills", skills)
graph.close()