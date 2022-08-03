# invana

Python API for Apache TinkerPop's Gremlin supported databases.

[![Apache license](https://img.shields.io/badge/license-Apache-blue.svg)](https://github.com/invanalabs/invana-py/blob/master/LICENSE)
[![Commit Activity](https://img.shields.io/github/commit-activity/m/invanalabs/invana-py)](https://github.com/invanalabs/invana-py/commits)
[![codecov](https://codecov.io/gh/invanalabs/invana-py/branch/master/graph/badge.svg)](https://codecov.io/gh/invanalabs/invana-py)

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Supported graph databases](#supported-graph-databases)
- [License](#license)

## Features

- [x] Object Mapper - Models, PropertyTypes, and Form validation
- [x] Execute gremlin queries
- [x] Built in QuerySets for performing standard CRUD operations on graph.
- [x] Utilities for logging queries and performance.
- [x] Django-ORM like search when using OGM(ex: has__id__within=[200752, 82032, 4320], has__name__startingWith="Per")(
  Refer [search-usage.md](search-usage.md) for more)
- [x] Index support
- [ ] Query caching support
- [ ] Asynchronous Python API.

## Installation

```shell
docker run -p 8182:8182  --name janusgraph-default janusgraph/janusgraph:latest -d
pip install git+https://github.com/invanalabs/invana-py.git#egg=invana

or 
# for latest code
pipenv install git+https://github.com/invana/invana@dev#egg=invana


```

## Usage

### Model first graph

```python
from invana import InvanaGraph
from invana.ogm.models import StructuredNode, StructuredRelationship
from invana.ogm.fields import StringProperty, DateTimeProperty, IntegerProperty, FloatProperty, BooleanProperty
from datetime import datetime
from invana.ogm import indexes

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
    indexes = (
        indexes.CompositeIndex("name"),
        indexes.CompositeIndex("created_at")
    )


class Person(StructuredNode):
    graph = graph
    properties = {
        'first_name': StringProperty(min_length=5, trim_whitespaces=True),
        'last_name': StringProperty(allow_null=True),
        'username': StringProperty(default="rrmerugu"),
        'member_since': IntegerProperty(),

    }
    indexes = (
        indexes.CompositeIndex("username"),
    )


class Authored(StructuredRelationship):
    graph = graph
    properties = {
        'created_at': DateTimeProperty(default=lambda: datetime.now())
    }
    indexes = (
        indexes.CompositeIndex("created_at")
    )


graph.management.create_model(Project)
graph.management.rollback_open_transactions(i_understand=True)
graph.management.create_indexes_from_model(Project)

Project.objects.delete()
Person.objects.delete()
Authored.objects.delete()

person = Person.objects.get_or_create(first_name="Ravi Raja", last_name="Merugu", member_since=2000)
project = Project.objects.create(name="Hello   ", rating=2.5, is_active=False)
authored_data = Authored.objects.create(person.id, project.id)

authored_list = Authored.objects.search().to_list()
project_list = Project.objects.search().to_list()

graph.close_connection()
```

### Searching graph

```python
# search by id
Project.objects.search(has__id=123).to_list()
Project.objects.search(has__id__within=[123, 232]).to_list()

# search string - eq, neq, startingWith, endingWith, containing, notStartingWith, notEndingWith, notContaining
Project.objects.search(has__name__eq="Ravi Raja").to_list()
Project.objects.search(has__name__neq="Ravi Raja").to_list()
Project.objects.search(has__name__neq="Ravi Raja").to_list()
Project.objects.search(has__name__startingWith="Ravi").to_list()
Project.objects.search(has__name__endingWith="Raja").to_list()
Project.objects.search(has__name__containing="Raja").to_list()
Project.objects.search(has__name__notStartingWith="Raja").to_list()
Project.objects.search(has__name__notEndingWith="Raja").to_list()
Project.objects.search(has__name__notContaining="Raja").to_list()

# lt, gt, lte, gte, inside, outside, between
Project.objects.search(has__member_since__lte=3000).to_list()
Project.objects.search(has__member_since__lt=3000).to_list()
Project.objects.search(has__member_since__gte=1999).to_list()
Project.objects.search(has__member_since__gt=1999).to_list()
Project.objects.search(has__member_since__inside=(1000, 3000)).to_list()
Project.objects.search(has__member_since__outside=(1000, 3000)).to_list()
Project.objects.search(has__member_since__between=(1000, 3000)).to_list()
```

Note: more info on usage [here](https://tinkerpop.apache.org/docs/3.5.0/reference/#a-note-on-predicates)

### Order by

You need to add indexing to run order queries efficiently. Read
more [here](https://docs.janusgraph.org/schema/index-management/index-performance/#ordering)

```python
Project.objects.search().order_by('name').to_list()  # asc order
Project.objects.search().order_by('-name').to_list()  # desc order
```

### Pagination

```python
# using range for pagination
queryset = Project.objects.search().order_by('name').range(1, 10).to_list()

# using paginator
from invana.ogm.paginator import QuerySetPaginator

page_size = 5
queryset = Project.objects.search().order_by("-serial_no")
paginator = QuerySetPaginator(queryset, page_size)
qs = paginator.page(1)
first_page = qs.to_list()
```

### Running queries

#### using execute_query method

```python
from invana import InvanaGraph

graph = InvanaGraph("ws://localhost:8182/gremlin", username="user", password="password")
results = graph.execute_query("g.V().limit(1).toList()", timeout=180)
graph.close_connection()
```

#### using execute_query_with_callback method

```python
from invana import InvanaGraph

graph = InvanaGraph("ws://localhost:8182/gremlin", username="user", password="password")
graph.execute_query_with_callback("g.V().limit(1).next()",
                                  lambda res: print(res.__len__()),
                                  finished_callback=lambda: graph.close_connection(),
                                  timeout=180)
graph.close_connection()
```

## Supported graph databases

- [JanusGraph](https://janusgraph.org/)

[comment]: <> (- [DataStax Enterprise]&#40;https://www.datastax.com/products/datastax-enterprise&#41;)

## License

Apache License, version 2.0


