from invana_connectors.core.element_structure import Node, RelationShip, Path
from neo4j.graph import (
    Node as Neo4jNode,
    Path as Neo4jPath,
    Relationship as Neo4jRelationship,
)
from neo4j.data import Record
from neomodel.contrib import SemiStructuredNode


class Neo4jRecordsSerialiser:

    def serialize_neo4j_node_to_invana_node(self, node):
        labels = list(node.labels)
        return Node(node.id, labels[0], properties=node._properties)
    
    def serialize_neo4j_rel_to_invana_rel(self, rel):
        outv = self.serialize_neo4j_node_to_invana_node(rel._start_node)
        inv = self.serialize_neo4j_node_to_invana_node(rel._end_node)
        return RelationShip(rel.id, rel.type, outv, inv, properties=rel._properties)

    def serialize_neo4j_others(self, r):
        return r
  

def convert_cypher_response_to_invana_objects(records):
    serializer = Neo4jRecordsSerialiser()
    records_serialized = []
    for record in records:
        if isinstance(record, Record):
            for r in record:
                if isinstance(r, Neo4jNode):
                    node = serializer.serialize_neo4j_node_to_invana_node(r)
                    records_serialized.append(node)
                elif isinstance(r, Neo4jRelationship):
                    rel = serializer.serialize_neo4j_rel_to_invana_rel(r)
                    records_serialized.append(rel)
                else:
                    other = serializer.serialize_neo4j_others(r)
                    records_serialized.append(other)
    return records_serialized


class NeoModelResponseSerializer:

    def get_properties(self, node):
        properties = {} 
        exclude_keys = ["id", "nodes"]
        for p in node.__dir__():
            if not p.startswith("_") and not callable(getattr(node, p)) and p not in exclude_keys:
                properties[p] = getattr(node, p)
        return properties
    
    def serialize_neo4model_node_to_invana_node(self, node):
        properties =self.get_properties(node)
        return Node(node.id, node.__class__.__name__, properties=properties)
    

def convert_neomodel_response_to_invana_objects(response):
    serializer = NeoModelResponseSerializer()
    records_serialized = []
    if isinstance(response , list):
        for record in response:
            if isinstance(record, Node) or isinstance(record, RelationShip):
                records_serialized.append(record)
            if isinstance(record, SemiStructuredNode) or isinstance(record, SemiStructuredNode):
                node = serializer.serialize_neo4model_node_to_invana_node(record)
                records_serialized.append(node)
            elif isinstance(record, Neo4jRelationship):
                rel = serializer.serialize_neo4j_rel_to_invana_rel(record)
                records_serialized.append(rel)
            else:
                other = serializer.serialize_neo4j_others(record)
                records_serialized.append(other)
        return records_serialized
    return serializer.serialize_neo4model_node_to_invana_node(response)