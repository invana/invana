from invana_connectors.querysets import RelationShipQuerySetBase


class RelationShipCypherQuerySet(RelationShipQuerySetBase):

    def create(self, label, from_, to_, **properties):
        raise NotImplementedError()