# Search Usage
, perform search using filters described in https://tinkerpop.apache.org/docs/3.5.0/reference/#a-note-on-predicates.
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