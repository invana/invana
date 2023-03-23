from invana_connectors.querysets import RelationShipQuerySetBase


class RelationShipGremlinQuerySet(RelationShipQuerySetBase):

    def create(self, label, from_, to_, **properties):
        raise NotImplementedError()