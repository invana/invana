from invana.gremlin.querysets.management import GremlinGraphManagementQuerySet
from .extras import JanusGraphExtrasQuerySet


class JanusGraphGraphManagementQuerySet(GremlinGraphManagementQuerySet):

    extras_cls = JanusGraphExtrasQuerySet
    