#    Copyright 2021 Invana
#
#     Licensed under the Apache License, Version 2.0 (the "License");
#     you may not use this file except in compliance with the License.
#     You may obtain a copy of the License at
#
#     http:www.apache.org/licenses/LICENSE-2.0
#
#     Unless required by applicable law or agreed to in writing, software
#    distributed under the License is distributed on an "AS IS" BASIS,
#     WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#     See the License for the specific language governing permissions and
#     limitations under the License.
from invana_connectors.core.base.connector import GraphConnectorBase
from neo4j import GraphDatabase, READ_ACCESS
from .transporter import CypherQueryRequest, CypherQueryResponse
from .querysets import NodeCypherQuerySet, RelationShipCypherQuerySet
from neo4j.exceptions import ClientError
import neo4j
from neomodel import (config, db as neo4j_db)
import logging
logger = logging.getLogger(__name__)


class CypherConnectorBase(GraphConnectorBase):

    connection = None
    connection_kwargs = None

    nodes_cls: NodeCypherQuerySet = NodeCypherQuerySet
    relationships_cls: RelationShipCypherQuerySet = RelationShipCypherQuerySet

    def __init__(self, connection_uri: str, is_readonly=False, default_timeout=None, auth=None, **kwargs) -> None:
        super().__init__(connection_uri, is_readonly=is_readonly, default_timeout=default_timeout, auth=auth, **kwargs)
        self.connection_kwargs = {}
        if self.auth:
            self.connection_kwargs['auth'] = self.auth    
            self.connection_kwargs['connection_timeout'] = self.default_timeout
        self.connect()
        config.DATABASE_URL = 'bolt://neo4j:test@localhost:7687'

        
    def _init_connection(self):
        logger.debug(f"create gremlin driver connection  ", self.connection_kwargs)
        self.connection =  GraphDatabase.driver(self.connection_uri, **self.connection_kwargs)

    @property
    def driver(self):
        return self.connection
 
    def _close_connection(self) -> None:
        self.connection.close()


 
    def execute_query(self, query:str, timeout:int=None, raise_exception:bool= False, finished_callback=None ):
        request = CypherQueryRequest(query)
        try:
            with self.connection.session() as session:
                result = session.run(query)
                res =list(result)
                return CypherQueryResponse(request.request_id, 200, data=res)
        except ClientError as e:
            request.response_received_but_failed(e)
            request.finished_with_failure(e)
            if raise_exception is True:
                raise e
            return CypherQueryResponse(request.request_id, 500, exception=e)
        # except ServerDisconnectedError as e:
        #     request.server_disconnected_error(e)
        #     request.finished_with_failure(e)
        #     if raise_exception is True:
        #         raise Exception(f"Failed to execute {request} with error message {e.__str__()}")
        #     return GremlinQueryResponse(request.request_id, 500, exception=e)
        # except RuntimeError as e:
        #     e.args = [f"Failed to execute {request} with error message {e.__str__()}"]
        #     request.runtime_error(e)
        #     request.finished_with_failure(e)
        #     if raise_exception is True:
        #         raise e
        #     return GremlinQueryResponse(request.request_id, None, exception=e)
        # except ClientConnectorError as e:
        #     e.args = [f"Failed to execute {request} with error message {e.__str__()}"]
        #     request.client_connection_error(e)
        #     request.finished_with_failure(e)
        #     if raise_exception is True:
        #         raise e
        #     return GremlinQueryResponse(request.request_id, 500, exception=e)
        # except Exception as e:
        #     e.args = [f"Failed to execute {request} with error message {e.__str__()}"]
        #     request.response_received_but_failed(e)
        #     request.finished_with_failure(e)
        #     if raise_exception is True:
        #         raise e
        #     return GremlinQueryResponse(request.request_id, None, exception=e)

        return records