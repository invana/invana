from invana_py import InvanaGraph
from invana_py.ogm.fields import StringProperty, IntegerProperty, DateTimeProperty
from invana_py.ogm.models import EdgeModel, VertexModel
from invana_py.serializer.element_structure import Node, RelationShip
from datetime import datetime

gremlin_url = "ws://megamind-ws:8182/gremlin"
graph = InvanaGraph(gremlin_url)


class Project(VertexModel):
    graph = graph
    properties = {
        'name': StringProperty(max_length=30, trim_whitespaces=True),
        'description': StringProperty(allow_null=True, min_length=10),
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


class Organisation(VertexModel):
    graph = graph

    properties = {
        'name': StringProperty(min_length=3, trim_whitespaces=True),
    }


class Authored(EdgeModel):
    graph = graph

    properties = {
        'created_at': DateTimeProperty(default=lambda: datetime.now())
    }


class TestVertexModelQuerySet:

    def test_create(self):
        graph.g.V().drop().iterate()

        project = Project.objects.create(name="invana-engine")
        assert isinstance(project, Node)
        assert isinstance(project.properties.created_at, datetime)

    def test_search(self):
        graph.g.V().drop().iterate()

        projects_list = ['invana-engine', 'invana-search']
        for project_string in projects_list:
            Project.objects.create(name=project_string)
        Organisation.objects.create(name="invana")

        projects = Project.objects.search().value_list()
        for project in projects:
            assert isinstance(project, Node)
            assert project.label == Project.label_name

        orgs = Organisation.objects.search().value_list()
        for org in orgs:
            assert isinstance(org, Node)
            assert org.label == Organisation.label_name
        graph.g.V().drop().iterate()

    # def test_search(self, graph: InvanaGraph):
    #     vtx = graph.vertex.search(has__label="GithubProject", has__name="invana-engine").element_map()
    #     assert isinstance(vtx[0], Node)

    def test_update(self):
        graph.g.V().drop().iterate()
        projects_list = ['invana-engine', 'invana-search']
        for project_string in projects_list:
            Project.objects.create(name=project_string)
        new_value = "invana-engine-new"
        instance = Project.objects.search(has__name="invana-engine").update(name=new_value)
        assert isinstance(instance[0], Node)
        assert instance[0].properties.name == new_value
