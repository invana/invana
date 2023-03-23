from invana_connectors.querysets import NodeQuerySetBase
from invana_connectors.cypher.decorators import serialize_neomodel_to_invana_objects
import importlib

class NodeGremlinQuerySet(NodeQuerySetBase):

    @serialize_neomodel_to_invana_objects
    def create(self, label, **properties):        
        pass
