# invana-py

Python API for Apache TinkerPop's Gremlin supported databases.

- [Features](#features)
- [Installation](#installation)
- [Examples](#examples)
- [Supported graph databases](#supported-graph-databases)
- [License](#license)

## Features

- Synchronous and Asynchronous Python API.
- Object Mapper - Models, PropertyTypes, and Form validation
- Execute gremlin queries
- Built in QuerySets for performing standard CRUD operations on graph.
- Query caching support
- Utilities for logging queries and performance.
- Django-ORM like search, perform search using filters described in https://tinkerpop.apache.org/docs/3.5.0/reference/#a-note-on-predicates.
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
 

## Installation

```shell
pip install git+https://github.com/invanalabs/invana-py.git#egg=invana_py
```

## Usage

### Performing CRUD on Graph

#### Using OGM

```python
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


Project.objects.delete_many()
Person.objects.delete_many()
Authored.objects.delete_many()

person = Person.objects.create(first_name="Ravi Raja", last_name="Merugu", member_since=2000)
print("person is :", person)
print("person as json :", person.to_json())
project = Project.objects.create(name="Hello   ", rating=2.5, is_active=False)
print("project is:", project)

projects = Project.objects.read_many()
print("projects", projects)

authored_single = Authored.objects.create(person.id, project.id)
authored = Authored.objects.read_many()
print("authored", authored)

graph.close_connection()

```

#### Without using OGM

```python
from invana_py import InvanaGraph
from datetime import datetime

graph = InvanaGraph("ws://megamind-ws:8182/gremlin", traversal_source="g")

user = graph.vertex.get_or_create("Person", properties={
    "first_name": "Ravi Raja",
    "last_name": "Merugu"
})

invana_studio_instance = graph.vertex.get_or_create("Project", properties={
    "name": "invana-studio",
    "description": "opensource connector visualiser for Invana connector analytics engine"
})
# <g:Vertex id=4128 label=GithubProject name=invana_py-studio description=opensource connector visualiser for Invana connector analytics engine/>

invana_engine_instance = graph.vertex.get_or_create("Project", properties={
    "name": "invana_py-engine",
    "description": "Invana connector analytics engine"
})

edge_instance = graph.edge.get_or_create("authored", user.id, invana_studio_instance.id, properties={
    "created_at": datetime.now()
})

engine_edge_instance = graph.edge.get_or_create("authored", user.id, invana_engine_instance.id, properties={
    "created_at": datetime.now()
})

```

### Performing raw queries

#### using execute_query method

```python
from invana_py import InvanaGraph

graph = InvanaGraph("ws://localhost:8182/gremlin", username="user", password="password")
results = graph.execute_query("g.V().limit(1).toList()", timeout=180)
graph.close_connection()
```

#### using execute_query_with_callback method

```python
from invana_py import InvanaGraph

graph = InvanaGraph("ws://localhost:8182/gremlin", username="user", password="password")
graph.execute_query_with_callback("g.V().limit(1).next()",
                                  lambda res: print(res.__len__()),
                                  finished_callback=lambda: graph.close_connection(),
                                  timeout=180)
graph.close_connection()

```

### Search usage (for read, delete, update)

#### for read_many, read_one, delete_many, delete_one

```python
from invana_py import InvanaGraph

graph = InvanaGraph("ws://localhost:8182/gremlin", username="user", password="password")

# without ogm
result = graph.vertex.read_many(has__label="Project")
result = graph.vertex.read_many(has__label__within=["Project", "Person"])
result = graph.vertex.read_many(has__id=1271)
result = graph.vertex.read_many(has__label="Project", has__name__containing="engine")
result = graph.edge.read_many(has__label="authored", has__created_at__lte=2021)

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

### Perform count queries

#### count using OGM

```python
result = Person.objects.count()
result = Person.objects.count(has__name__containing="engine")
```

#### count without using OGM

```python
result = graph.vertex.count(has__label="Project", has__name__containing="engine")
result = graph.vertex.count(has__label__within=["Project", "Person"])
```

## Examples

Checkout examples [here](examples/) for reference.

## Supported graph databases

- [JanusGraph](https://janusgraph.org/)

[comment]: <> (- [DataStax Enterprise]&#40;https://www.datastax.com/products/datastax-enterprise&#41;)

## License

Apache License, version 2.0


