from invana_connectors.querysets import NodeQuerySetBase
from neomodel.contrib import SemiStructuredNode
from neomodel import ( config, exceptions )
from invana_connectors.cypher.decorators import serialize_neomodel_to_invana_objects
from neomodel.core import db

def get_or_create_class(label_name):
    label_set = frozenset([label_name,])
    if label_set in db._NODE_CLASS_REGISTRY:
        return db._NODE_CLASS_REGISTRY[label_set]
    label_cls = type(label_name, (SemiStructuredNode,), {}) 
    return label_cls

class NodeCypherQuerySet(NodeQuerySetBase):

    @serialize_neomodel_to_invana_objects
    def create(self, label, **properties):        
        label_cls = get_or_create_class(label)
        return label_cls(**properties).save()
 
