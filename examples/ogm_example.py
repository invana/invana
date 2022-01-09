from invana_py import InvanaGraph
from invana_py.ogm.models import VertexModel, EdgeModel
from invana_py.ogm.fields import StringProperty, DateTimeProperty, IntegerProperty, FloatProperty, BooleanProperty
from datetime import datetime

graph = InvanaGraph("ws://megamind-ws:8182/gremlin", traversal_source="g")


class Project(VertexModel):
    graph = graph
    properties = {
        'name': StringProperty(max_length=10, trim_whitespaces=True),
        'description': StringProperty(allow_null=True, min_length=10),
        'rating': FloatProperty(allow_null=True),
        'is_active': BooleanProperty(default=True),
        'created_at': DateTimeProperty(default=lambda: datetime.now())
    }


class Person(VertexModel):
    graph = graph
    properties = {
        'first_name': StringProperty(min_length=5, trim_whitespaces=True),
        'last_name': StringProperty(allow_null=True),
        'username': StringProperty(default="rrmerugu"),
        'member_since': IntegerProperty(),

    }


class Authored(EdgeModel):
    graph = graph
    properties = {
        'created_at': DateTimeProperty(default=lambda: datetime.now())
    }


Project.objects.delete()
Person.objects.delete()
Authored.objects.delete()

person = Person.objects.create(first_name="Ravi Raja", last_name="Merugu", member_since=2000).element_map()
print("person is :", person)
print("person as json :", person)
project = Project.objects.create(name="Hello   ", rating=2.5, is_active=False).element_map()
print("project is:", project[0].to_json())

projects = Project.objects.search().element_map()
print("projects", projects)

authored_single = Authored.objects.create(person[0].id, project[0].id).element_map()
authored = Authored.objects.search().element_map()
print("authored", authored)

graph.close_connection()
