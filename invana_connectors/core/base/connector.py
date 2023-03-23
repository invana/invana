from __future__ import annotations
from typing import TYPE_CHECKING

import abc
import logging
from invana_connectors.core.base.constants import ConnectionStateTypes
from invana_connectors.settings import DEFAULT_TIMEOUT
if TYPE_CHECKING:
    from invana_connectors.querysets import  NodeQuerySetBase, RelationShipQuerySetBase
#     from .querysets.management import GraphManagementQuerySetBase

logger = logging.getLogger(__name__)


class GraphConnectorBase(object):
    
    nodes_cls: NodeQuerySetBase = NotImplemented
    relationships_cls: RelationShipQuerySetBase = NotImplemented
    # management_cls: GraphManagementQuerySetBase = NotImplemented
 
    nodes: NodeQuerySetBase = None
    relationships : RelationShipQuerySetBase = None
    def __init__(self, connection_uri:str, is_readonly=False, default_timeout=None, auth=None, **kwargs ) -> None:
        self.CONNECTION_STATE = None
        self.connection_uri = connection_uri
        self.is_readonly = is_readonly
        self.auth = auth
        self.default_timeout = DEFAULT_TIMEOUT if default_timeout is None else default_timeout

    def __new__(cls, *args, **kwargs):
        instance = super(GraphConnectorBase, cls).__new__(cls)
        # instance = cls(*args, **kwargs)
        instance.nodes = instance.nodes_cls(instance)
        instance.relationships  = instance.relationships_cls(instance)
        return instance
    
    # @property
    # @abc.abstractmethod
    # def connection_uri(self):
    #     pass

    # @property
    # @abc.abstractmethod
    # def CONNECTION_STATE(self):
        # pass

    @abc.abstractmethod
    def _init_connection(self):
        pass

    @abc.abstractmethod
    def _close_connection(self):
        pass    

    def connect(self):
        self.update_connection_state(ConnectionStateTypes.CONNECTING)
        self._init_connection()
        self.update_connection_state(ConnectionStateTypes.CONNECTED)

    def reconnect(self):
        self.update_connection_state(ConnectionStateTypes.RECONNECTING)
        self.connect()

    def close(self) -> None:
        self.update_connection_state(ConnectionStateTypes.DISCONNECTING)
        self._close_connection()
        self.update_connection_state(ConnectionStateTypes.DISCONNECTED)

    def update_connection_state(self, new_state):
        self.CONNECTION_STATE = new_state
        logger.debug(f"GraphConnector state updated to : {self.CONNECTION_STATE}")


    @abc.abstractmethod
    def serialize_response(self, response):
        pass

    @abc.abstractmethod
    def execute_query(self, query:str, timeout:int=None, raise_exception:bool= False, finished_callback=None ):
        pass

 