from invana_connectors.core.element_structure import Node, RelationShip, Path
from neo4j.graph import (
    Node as Neo4jNode,
    Path as Neo4jPath,
    Relationship as Neo4jRelationship,
)
from neo4j.data import Record


class RecordsSerialiser:


    def serialize_neo4j_node_to_invana_node(self, node):
        labels = list(node.labels)
        return Node(node.id, labels[0], properties=node._properties)
    
    def serialize_neo4j_rel_to_invana_rel(self, rel):
        outv = self.serialize_neo4j_node_to_invana_node(rel._start_node)
        inv = self.serialize_neo4j_node_to_invana_node(rel._end_node)
        return RelationShip(rel.id, rel.type, outv, inv, properties=rel._properties)

    def serialize_neo4j_others(self, r):
        return r
        # outv = self.serialize_neo4j_node_to_invana_node(rel._start_node)
        # inv = self.serialize_neo4j_node_to_invana_node(rel._end_node)
        # return RelationShip(rel.id, rel.type, outv, inv, properties=rel._properties)


def convert_cypher_response_to_invana_objects(records):

    serializer = RecordsSerialiser()

    records_serialized = []
    for record in records:
        t = type(record)

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