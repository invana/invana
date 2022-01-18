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


class TestQuerySetPaginator:

    def test_pagination(self):
        graph.g.V().drop().iterate()
        for i in range(1, 100):
            Project.objects.create(name=f"invana-engine {i}", serial_no=i)

        page_size = 5
        page_no = 2

        queryset = Project.objects.search().order_by("serial_no")
        paginator = QuerySetPaginator(queryset, page_size)
        qs = paginator.page(page_no)
        first_page = qs.to_list()
        assert first_page.__len__() == page_size
