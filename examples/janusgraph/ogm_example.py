from invana import InvanaGraph
from invana.ogm.models import VertexModel, EdgeModel
from invana.ogm.fields import StringProperty, DateTimeProperty, IntegerProperty, FloatProperty, BooleanProperty
from datetime import datetime

graph = InvanaGraph("ws://megamind.local:8182/gremlin")


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


# Project.objects.delete()
# Person.objects.delete()
# Authored.objects.delete()

# person = Person.objects.create(first_name="Ravi Raja", last_name="Merugu", member_since=2000)
# print("person is :", person)
# print("person as json :", person.to_json())
# project = Project.objects.create(name="Hello   ", rating=2.5, is_active=False)
# print("project is:", project.to_json())

# projects = Project.objects.search().to_list()
# print("projects", projects)

# authored_single = Authored.objects.create(person.id, project.id)
# print("authored_single", authored_single)
# authored = Authored.objects.search().to_list()
# print("authored", authored)


# project_search = Project.objects.search().to_list()
# project_count = Project.objects.search().count()
# project_search_startsWith = Project.objects.search(has__name__startingWith="He").to_list()
# project_search_has__id = Project.objects.search(has__id=123).to_list()
# project_search_has__id_within = Project.objects.search(has__id__within=[123, 232]).to_list()


# print("project_lists", project_search)
# print("=======")
# print("project_count", project_count)
# print("=======")
# print("project_search_startsWith", project_search_startsWith)
# print("=======")
# print("project_search_has__id", project_search_has__id)
# # print("=======")
# print("project_search_has__id_within", project_search_has__id_within)


inside_query = Person.objects.search(has__member_since__inside=(1000, 3000)).to_list()
print("inside_query", inside_query)
# Person.objects.search(has__member_since__outside=(1000, 3000)).to_list()
# Person.objects.search(has__member_since__between=(1000, 3000)).to_list()

graph.close()

