from invana import InvanaGraph
from invana.ogm.fields import StringProperty, IntegerProperty, DateTimeProperty
from invana.ogm.models import EdgeModel, VertexModel
from invana.serializer.element_structure import Node, RelationShip
from datetime import datetime
import os

gremlin_server_url = os.environ.get("GREMLIN_SERVER_URL", "ws://megamind.local:8182/gremlin")
graph = InvanaGraph(gremlin_server_url)


class Project(VertexModel):
    graph = graph
    properties = {
        'name': StringProperty(max_length=30, trim_whitespaces=True),
        'description': StringProperty(allow_null=True, min_length=10),
        'created_at': DateTimeProperty(default=lambda: datetime.now())
    }


class Organisation(VertexModel):
    graph = graph

    properties = {
        'name': StringProperty(min_length=3, trim_whitespaces=True),
    }


class TestVertexModelQuerySet:

    def test_create(self):
        graph.connector.g.V().drop().iterate()
        project = Project.objects.create(name="invana-engine")
        assert isinstance(project, Node)
        assert isinstance(project.properties.created_at, datetime)

    def test_search(self):
        graph.connector.g.V().drop().iterate()

        projects_list = ['invana-engine', 'invana-search']
        for project_string in projects_list:
            Project.objects.create(name=project_string)
        Organisation.objects.create(name="invana")

        projects = Project.objects.search().to_list()
        for project in projects:
            assert isinstance(project, Node)
            assert project.label == Project.label_name

        orgs = Organisation.objects.search().to_list()
        for org in orgs:
            assert isinstance(org, Node)
            assert org.label == Organisation.label_name
        graph.connector.g.V().drop().iterate()

    def test_update(self):
        graph.connector.g.V().drop().iterate()
        projects_list = ['invana-engine', 'invana-search']
        for project_string in projects_list:
            Project.objects.create(name=project_string)
        new_value = "invana-engine-new"
        instance = Project.objects.search(has__name="invana-engine").update(name=new_value)
        assert isinstance(instance[0], Node)
        assert instance[0].properties.name == new_value
        graph.connector.g.V().drop().iterate()

    def test_delete(self):
        graph.connector.g.V().drop().iterate()
        projects_list = ['invana-engine', 'invana-search']
        project = Project.objects.create(name=projects_list[0])
        Project.objects.delete(has__id=project.id)
        projects = Project.objects.search(has__id=project.id).to_list()
        assert projects.__len__() == 0
        projects = Project.objects.search(has__name=projects_list[0]).to_list()
        assert projects.__len__() == 0
        graph.connector.g.V().drop().iterate()
