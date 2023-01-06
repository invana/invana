from invana.gremlin.connector import GremlinConnector
from .querysets import JanusGraphExtrasQuerySet, JanusGraphGraphManagementQuerySet


class JanusGraphConnector(GremlinConnector):

        management_cls = JanusGraphGraphManagementQuerySet
        
