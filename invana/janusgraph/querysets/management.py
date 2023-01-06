from invana.gremlin.querysets import GremlinGraphManagementQuerySet
from . import JanusGraphExtrasQuerySet


class JanusGraphGraphManagementQuerySet(GremlinGraphManagementQuerySet):

    extras_cls = JanusGraphExtrasQuerySet
    