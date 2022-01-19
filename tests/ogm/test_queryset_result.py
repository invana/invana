import math
from invana_py import InvanaGraph
from invana_py.ogm.fields import StringProperty, IntegerProperty
from invana_py.ogm.models import VertexModel
from invana_py.ogm.paginator import QuerySetPaginator

gremlin_url = "ws://megamind-ws:8182/gremlin"
graph = InvanaGraph(gremlin_url)


class Project(VertexModel):
    graph = graph
    properties = {
        'name': StringProperty(max_length=30, trim_whitespaces=True),
        "serial_no": IntegerProperty()
    }


class TestQuerySetResultSet:

    def test_order_by(self):
        graph.g.V().drop().iterate()
        for i in range(1, 100):
            Project.objects.create(name=f"invana-engine {i}", serial_no=i)

        total = Project.objects.search().count()
        total = int(total)
        page_size = 5
        total_pages = math.ceil(total / page_size)
        queryset = Project.objects.search().order_by("serial_no")
        paginator = QuerySetPaginator(queryset, page_size)
        for page_no in range(1, total_pages):
            qs = paginator.page(page_no)
            result = qs.to_list()
            assert result[0].properties.serial_no == ((page_no - 1) * page_size) + 1