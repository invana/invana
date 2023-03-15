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


## Features

- [ ] Object Mapper - Models, PropertyTypes, and Form validation
- [ ] Execute gremlin and cypher queries
- [ ] Built in QuerySets for performing standard CRUD operations on graph.
- [ ] Utilities for logging queries and performance.
- [ ] Django-ORM like search when using OGM.
- [ ] Index support.
- [ ] Query caching support

## Supported databases

- [ ] Janusgraph
- [ ] Neo4j 

> **NOTE** - Any cypher or gremlin based graph databases can be supported with custom code

## Requirements

1. graph database
2. Python 3.7+

## Installation

```shell
pip install git+https://github.com/invanalabs/invana.git#egg=invana_connectors

or 
# for latest code
pipenv install git+https://github.com/invana/invana@refactors/invana-connectors2#egg=invana_connectors
```
 
## License

Apache License, version 2.0


