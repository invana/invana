from __future__ import annotations
from typing import TYPE_CHECKING

import abc
import logging
from .constants import ConnectionStateTypes
if TYPE_CHECKING:
    from .querysets import  VertexCRUDQuerySetBase, EdgeCRUDQuerySetBase, GraphManagementQuerySetBase

logger = logging.getLogger(__name__)


class GraphConnectorBase:
    
    vertex_cls: VertexCRUDQuerySetBase = NotImplemented
    edge_cls: EdgeCRUDQuerySetBase = NotImplemented
    management_cls: GraphManagementQuerySetBase = NotImplemented
 

    def __init__(self, connection_uri:str, is_readonly=False, default_timeout=None, **kwargs ) -> None:
        self.CONNECTION_STATE = None

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

 