from invana_connectors.querysets import NodeQuerySetBase
from neomodel.contrib import SemiStructuredNode
from neomodel import ( config, exceptions )
from invana_connectors.cypher.decorators import serialize_neomodel_to_invana_objects
import importlib

class NodeCypherQuerySet(NodeQuerySetBase):

    @serialize_neomodel_to_invana_objects
    def create(self, label, **properties):        
        try:
            label_cls = type(label, (SemiStructuredNode,), {}) 
        except exceptions.NodeClassAlreadyDefined:
            label_cls = i = getattr(importlib.import_module('neomodel.core'), label)
        return label_cls(**properties).save()
 
