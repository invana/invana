# Invana Python API

**NOTE** - Under active development

Async Python API for Apache TinkerPop's Gremlin supported databases.

## Installation
```shell
pip install git+https //github.com/invanalabs/invana-py.git#egg=invana
```
## Features

- Synchronous and Asynchronous Python API
- Run your gremlin queries.
- JSON response
- Create vertices and edges with properties.
- Read one or many vertices and edges.
- Update properties of on or many vertices and edges.
- Delete one or many vertices and edges.
- Supports querying with pagination
- Vertex based queries methods `read_inedges`, `read_incoming_vertices_with_inedges`,
  `read_outgoing_vertices_with_inedges`, `read_bothv_with_outedges`.
- Query data using search filters described in https://tinkerpop.apache.org/docs/3.5.0/reference/#a-note-on-predicates. Following filter keyword patterns are supported with read_many()
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

```python

from invana import InvanaClient

client = InvanaClient("ws://localhost:8182/gremlin")

user = await client.vertex.get_or_create("User", properties={
    "name": "Ravi",
    "username": "rrmerugu"
})
print(user)
#<g:Vertex id=20544 label=User name=Ravi username=rrmerugu/>
print(user.to_dict())
#{'id': 20544, 'label': 'User', 'properties': {'username': 'rrmerugu', 'name': 'Ravi'}}


invana_studio_instance = await client.vertex.get_or_create("GithubProject", properties={
    "name": "invana-studio",
    "description": "opensource graph visualiser for Invana graph analytics engine"
})
#<g:Vertex id=4128 label=GithubProject name=invana-studio description=opensource graph visualiser for Invana graph analytics engine/>

invana_engine_instance = await client.vertex.get_or_create("GithubProject", properties={
    "name": "invana-engine",
    "description": "Invana graph analytics engine"
})

edge_instance = await client.edge.get_or_create("authored", user.id, invana_studio_instance.id, properties={
    "started": 2020
})
print(edge_instance)
#<g:Edge id=8p4-fuo-bv9-36o User(20544)--authored-->GithubProject(4128) started=2020/>
print(edge_instance.to_dict())
#{'id': '8p4-fuo-bv9-36o', 'label': 'authored', 'properties': {'started': 2020}, 'inv_label': 'GithubProject', 'inv': 4128, 'outv_label': 'User', 'outv': 4128}


engine_edge_instance = await client.edge.get_or_create("authored", user.id, invana_engine_instance.id, properties={
    "started": 2020
})
    
_ = await client.vertex.read_many(has__label="GithubProject")
#<g:Vertex id=4128 label=GithubProject name=invana-studio description=opensource graph visualiser for Invana graph analytics engine/>
#<g:Vertex id=16512 label=GithubProject name=invana-engine description=Invana graph analytics engine/>

_ = await client.vertex.read_many(has__label__within=["GithubProject", "User"])
#<g:Vertex id=4128 label=GithubProject name=invana-studio description=opensource graph visualiser for Invana graph analytics engine/>
#<g:Vertex id=20544 label=User name=Ravi username=rrmerugu/>
#<g:Vertex id=16512 label=GithubProject name=invana-engine description=Invana graph analytics engine/>

_ = await client.vertex.read_many(has__id=invana_studio_instance.id)
# <g:Vertex id=4128 label=GithubProject name=invana-studio description=opensource graph visualiser for Invana graph analytics engine/>

edges = await client.edge.read_many(has__started__lte=2021)
#<g:Edge id=8p4-fuo-bv9-36o User(20544)--authored-->GithubProject(4128) started=2020/>
#<g:Edge id=93c-fuo-bv9-cqo User(20544)--authored-->GithubProject(16512) started=2020/>

_ = await client.vertex.read_many(has__name__containing="engine")
#<g:Vertex id=16512 label=GithubProject name=invana-engine description=Invana graph analytics engine/>

```
## TODO
  - supports for authentication

## Licenses

Apache License, version 2.0


