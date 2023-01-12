import math
from invana import InvanaGraph
from invana.ogm.fields import StringProperty, IntegerProperty
from invana.ogm.models import VertexModel
from invana.gremlin.paginator import GremlinQuerySetPaginator
import os

gremlin_server_url = os.environ.get("GREMLIN_SERVER_URL", "ws://megamind.local:8182/gremlin")
graph = InvanaGraph(gremlin_server_url)


class Project(VertexModel):
    graph = graph
    properties = {
        'name': StringProperty(max_length=30, trim_whitespaces=True),
        "serial_no": IntegerProperty()
    }


class TestQuerySetPaginator:

    def test_pagination(self):
        graph.connector.g.V().drop().iterate()
        for i in range(1, 100):
            Project.objects.create(name=f"invana-engine {i}", serial_no=i)

        page_size = 5
        page_no = 2

        queryset = Project.objects.search().order_by("serial_no")
        paginator = GremlinQuerySetPaginator(queryset, page_size)
        qs = paginator.page(page_no)
        first_page = qs.to_list()
        assert first_page.__len__() == page_size

    def test_pagination_more_pages(self):
        graph.connector.g.V().drop().iterate()
        for i in range(1, 100):
            Project.objects.create(name=f"invana-engine {i}", serial_no=i)

        total = Project.objects.search().count()
        total = int(total)
        page_size = 5
        total_pages = math.ceil(total / page_size)
        queryset = Project.objects.search().order_by("serial_no")
        paginator = GremlinQuerySetPaginator(queryset, page_size)
        for page_no in range(1, total_pages):
            qs = paginator.page(page_no)
            result = qs.to_list()
            assert result.__len__() == page_size
