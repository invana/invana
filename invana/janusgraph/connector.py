from invana.gremlin.connector import GremlinConnector
from .management import  JanusGraphGraphManagement


class JanusGraphConnector(GremlinConnector):
        management_cls = JanusGraphGraphManagement
        
