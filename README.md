# invana

Python API for modelling and querying knowledge graphs.

[![Apache license](https://img.shields.io/badge/license-Apache-blue.svg)](https://github.com/invanalabs/invana-py/blob/master/LICENSE)
[![Commit Activity](https://img.shields.io/github/commit-activity/m/invanalabs/invana-py)](https://github.com/invanalabs/invana-py/commits)
[![codecov](https://codecov.io/gh/invanalabs/invana-py/branch/master/graph/badge.svg)](https://codecov.io/gh/invanalabs/invana-py)

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Supported graph databases](#supported-graph-databases)
- [License](#license)

## Supported databases

- [x] Janusgraph
- [ ] Neo4j 

## Features

- [x] Object Mapper - Models, PropertyTypes, and Form validation
- [x] Execute gremlin and cypher queries
- [x] Built in QuerySets for performing standard CRUD operations on graph.
- [x] Utilities for logging queries and performance.
- [x] Django-ORM like search when using OGM.
- [x] Index support.
- [ ] Query caching support

## Installation

```shell
docker run -p 8182:8182  --name janusgraph-default janusgraph/janusgraph:latest -d
pip install git+https://github.com/invanalabs/invana.git#egg=invana_connectors

or 
# for latest code
pipenv install git+https://github.com/invana/invana@refactors/invana-connectors2#egg=invana_connectors


```


## Supported graph databases

- [JanusGraph](https://janusgraph.org/)

[comment]: <> (- [DataStax Enterprise]&#40;https://www.datastax.com/products/datastax-enterprise&#41;)

## License

Apache License, version 2.0


