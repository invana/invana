from invana import InvanaGraph
from invana.ogm.models import StructuredNode, StructuredRelationship
from invana.ogm.fields import StringProperty, DateTimeProperty, IntegerProperty, FloatProperty, BooleanProperty
from datetime import datetime

graph = InvanaGraph("ws://megamind-ws:8182/gremlin", traversal_source="g")


class Project(StructuredNode):
    graph = graph
    properties = {
        'name': StringProperty(max_length=10, trim_whitespaces=True),
        'description': StringProperty(allow_null=True, min_length=10),
        'rating': FloatProperty(allow_null=True),
        'is_active': BooleanProperty(default=True),
        'created_at': DateTimeProperty(default=lambda: datetime.now())
    }


class Person(StructuredNode):
    graph = graph
    properties = {
        'first_name': StringProperty(min_length=5, trim_whitespaces=True),
        'last_name': StringProperty(allow_null=True),
        'username': StringProperty(default="rrmerugu"),
        'member_since': IntegerProperty(),

    }


class Authored(StructuredRelationship):
    graph = graph
    properties = {
        'created_at': DateTimeProperty(default=lambda: datetime.now())
    }


Project.objects.delete()
Person.objects.delete()
Authored.objects.delete()

person = Person.objects.create(first_name="Ravi Raja", last_name="Merugu", member_since=2000)
print("person is :", person)
print("person as json :", person.to_json())
project = Project.objects.create(name="Hello   ", rating=2.5, is_active=False)
print("project is:", project.to_json())

projects = Project.objects.search().to_list()
print("projects", projects)

authored_single = Authored.objects.create(person.id, project.id)
print("authored_single", authored_single)
authored = Authored.objects.search().to_list()
print("authored", authored)

graph.close_connection()
