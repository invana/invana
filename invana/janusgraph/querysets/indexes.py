from invana.gremlin.querysets import GremlinIndexCRUD
from invana.ogm.indexes import MixedIndex, CompositeIndex
# TODO - move MixedIndex, CompositeIndex to Janusgraph

class JanusGraphIndexCRUD(GremlinIndexCRUD):

    def create_from_model(self, model, timeout_per_index=None):
        indexes = model.indexes
        model_indexes = []
        for index in indexes:
            if isinstance(index, CompositeIndex):
                model_index = CompositeIndex(*index.property_keys, label=model.label_name)
                model_indexes.append(model_index)
            elif isinstance(index, MixedIndex):
                model_index = MixedIndex(*index.property_keys, label=model.label_name)
                model_indexes.append(model_index)
        statuses = []
        for index in indexes:
            _ = self.create_index(index, timeout=timeout_per_index)
            statuses.append(_)
        return statuses

    def create(self, index: [MixedIndex, CompositeIndex], timeout=None):
        # return self._create_index(*index.property_keys, label=index.label,
        #                           index_type=index.index_type,
        #                           index_name=index.index_name, timeout=timeout)
        index_name=index.index_name
        label = index.label
        property_keys = index.property_keys
        index_type = index.index_type
        if index_type not in ["Mixed", "Composite"]:
            raise ValueError('index_type should be ["Mixed", "Composite"]')
        timeout = timeout if timeout else 60 * 30 * 1000  # ie., 30 minutes
        # check for open transactions
        has_open_transactions = self.get_open_transactions_size().data[0] > 1
        if has_open_transactions:
            raise Exception("Cannot create_index when there are open transactions ")

        query, index_name__ = self.index_creator.create_index_query(property_keys, label=label,
                                                                    index_type=index_type,
                                                                    index_name=index_name)
        query += self.index_creator.wait_for_index_query(index_name__)
        query += self.index_creator.reindex_query(index_name__)
        return self.connector.execute_query(query, timeout=timeout)


    def reindex(self, index : [MixedIndex, CompositeIndex], *args, **kwargs):
        timeout = timeout if timeout else 60 * 30 * 1000  # ie., 30 minutes
        index_name = index if isinstance(index, str) else index.index_name
        query = self.index_creator.reindex_query(index_name)
        return self.connector.execute_query(query, timeout=timeout)

    def remove(self, index_name, *args, **kwargs):
        raise NotImplementedError()

    def update(self, index_name, *args, **kwargs):
        raise NotImplementedError()

    def read(self, index_name, *args, **kwargs):
        raise NotImplementedError()

    def read_all(self, *args, **kwargs):
        raise NotImplementedError()
    
    def check_status(self, index_name, *args, **kwargs):
        raise NotImplementedError()