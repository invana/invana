class GremlinConnector:
pass# Gremlin Connector

**NOTE** - Under active development

Python API for Apache TinkerPop's Gremlin supported databases.

## Installation

```shell
pip install git+https://github.com/invanalabs/gremlin-connector.git#egg=gremlin_connector
```

[comment]: <> (-  ## Tested graph databases )

[comment]: <> (- [JanusGraph]&#40;https://janusgraph.org/&#41;)

[comment]: <> (- [DataStax Enterprise]&#40;https://www.datastax.com/products/datastax-enterprise&#41;)

## Features

- Run your gremlin queries.
- JSON response
- CRUD on vertices and edges with properties.
- Read one or many vertices and edges.
- Update properties of on or many vertices and edges.
- Delete one or many vertices and edges.
- Supports querying with pagination.
  [comment]: <> (- Vertex based queries methods `read_inedges`, `read_incoming_vertices_with_inedges`,)

[comment]: <> (  `read_outgoing_vertices_with_inedges`, `read_bothv_with_outedges`.)

- Query data using search filters described in https://tinkerpop.apache.org/docs/3.5.0/reference/#a-note-on-predicates.
  Following filter keyword patterns are supported with `read_many`, `read_one`, `delete_many`,
  `delete_one`, `update_many`,`update_one`
    - has__id=1021
    - has__id__within=[200752, 82032, 4320],
    - has__label__within=["Person", "Planet"]
    - has__label__without=["Person", "Planet"]
    - has__label="Person"
    - has__age__lte=25
    - has__age__lt=25
    - has__age__gte=25
    - has__age__gt=25
    - has__age__inside=(10, 20)
    - has__age__outside=(10, 20)
    - has__age__between=(10, 20)
    - has__label__eq="Person"
    - has__label__neq="Person"
    - has__name__startingWith="Per"
    - has__name__endingWith="son"
    - has__name__containing="erson"
    - has__name__notStartingWith="son"
    - has__name__notEndingWith="son"
    - has__name__notContaining="son"
    - pagination__limit=10
    - pagination__range=[0, 10]

## Usage

### Using OGM

```python
from gremlin_connector import GremlinConnector
from gremlin_connector.orm.models import VertexModel, EdgeModel
from gremlin_connector.orm.fields import StringProperty, DateTimeProperty, IntegerProperty, FloatProperty, BooleanProperty
from datetime import datetime

gremlin_connector = GremlinConnector("ws://megamind-ws:8182/gremlin", traversal_source="g")


class Project(VertexModel):
    gremlin_connector = gremlin_connector
    properties = {
        'name': StringProperty(max_length=10, trim_whitespaces=True),
        'description': StringProperty(allow_null=True, min_length=10),
        'rating': FloatProperty(allow_null=True),
        'is_active': BooleanProperty(default=True),
        'created_at': DateTimeProperty(default=lambda: datetime.now())
    }


class Person(VertexModel):
    gremlin_connector = gremlin_connector
    properties = {
        'first_name': StringProperty(min_length=5, trim_whitespaces=True),
        'last_name': StringProperty(allow_null=True),
        'username': StringProperty(default="rrmerugu"),
        'member_since': IntegerProperty(),

    }


class Authored(EdgeModel):
    gremlin_connector = gremlin_connector
    properties = {
        'created_at': DateTimeProperty(default=lambda: datetime.now())
    }


Project.objects.delete_many()
Person.objects.delete_many()
Authored.objects.delete_many()

person = Person.objects.create(first_name="Ravi Raja", last_name="Merugu", member_since=2000)
print("person is :", person)
project = Project.objects.create(name="Hello   ", rating=2.5, is_active=False)
print("project is:", project)

projects = Project.objects.read_many()
print("projects", projects)

authored_single = Authored.objects.create(person.id, project.id)
authored = Authored.objects.read_many()
print("authored", authored)

gremlin_connector.close_connection()

```

### Without using OGM

```python
from gremlin_connector import GremlinConnector
from datetime import datetime

gremlin_connector = GremlinConnector("ws://megamind-ws:8182/gremlin", traversal_source="g")

user = gremlin_connector.vertex.get_or_create("Person", properties={
    "first_name": "Ravi Raja",
    "last_name": "Merugu"
})

invana_studio_instance = gremlin_connector.vertex.get_or_create("Project", properties={
    "name": "gremlin_connector-studio",
    "description": "opensource graph visualiser for Invana graph analytics engine"
})
# <g:Vertex id=4128 label=GithubProject name=gremlin_connector-studio description=opensource graph visualiser for Invana graph analytics engine/>

invana_engine_instance = gremlin_connector.vertex.get_or_create("Project", properties={
    "name": "gremlin_connector-engine",
    "description": "Invana graph analytics engine"
})

edge_instance = gremlin_connector.edge.get_or_create("authored", user.id, invana_studio_instance.id, properties={
    "created_at": datetime.now()
})

engine_edge_instance = gremlin_connector.edge.get_or_create("authored", user.id, invana_engine_instance.id, properties={
    "created_at": datetime.now()
})

```

### Performing raw queries

#### using execute_query method

```python
from gremlin_connector import GremlinConnector

gremlin_connector = GremlinConnector("ws://localhost:8182/gremlin", username="user", password="password")
results = gremlin_connector.execute_query("g.V().limit(1).toList()", timeout=180)
gremlin_connector.close_connection()
```

#### using execute_query_with_callback method
```python
from gremlin_connector import GremlinConnector

gremlin_connector = GremlinConnector("ws://localhost:8182/gremlin", username="user", password="password")
gremlin_connector.execute_query_with_callback("g.V().limit(1).next()",
                                              lambda res: print(res.__len__()),
                                              finished_callback=lambda: gremlin_connector.close_connection(),
                                              timeout=180)
gremlin_connector.close_connection()

```

### Search usage (for read, delete, update)

#### for read_many, read_one, delete_many, delete_one

```python
from gremlin_connector import GremlinConnector

gremlin_connector = GremlinConnector("ws://localhost:8182/gremlin", username="user", password="password")

# without ogm
result = gremlin_connector.vertex.read_many(has__label="Project")
result = gremlin_connector.vertex.read_many(has__label__within=["Project", "Person"])
result = gremlin_connector.vertex.read_many(has__id=1271)
result = gremlin_connector.vertex.read_many(has__label="Project", has__name__containing="engine")
result = gremlin_connector.edge.read_many(has__label="authored", has__created_at__lte=2021)

# with ogm
result = Project.objects.read_many(has__id=1271)
result = Project.objects.read_many(has__name__containing="engine")
result = Authored.objects.read_many(has__created_at__lte=2021)

```

#### for update_many, update_one
```python

person = Person.objects.update_one(query_kwargs={"has__first_name__containing": "Ravi"},
                                   properties={"last_name": f"Merugu (updated)"})

```

## License

Apache License, version 2.0


