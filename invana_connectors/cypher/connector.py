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
import neo4j
import logging
logger = logging.getLogger(__name__)


class CypherConnectorBase(GraphConnectorBase):

    connection = None
    connection_kwargs = None

    def __init__(self, connection_uri: str, is_readonly=False, default_timeout=None, auth=None, **kwargs) -> None:
        super().__init__(connection_uri, is_readonly=is_readonly, default_timeout=default_timeout, auth=auth, **kwargs)
        self.connection_kwargs = {}
        if self.auth:
            self.connection_kwargs['auth'] = self.auth    
            self.connection_kwargs['connection_timeout'] = self.default_timeout
        self.connect()

        
    def _init_connection(self):
        logger.debug(f"create gremlin driver connection  ", self.connection_kwargs)
        self.connection =  GraphDatabase.driver(self.connection_uri, **self.connection_kwargs)

    @property
    def driver(self):
        return self.connection

    def _close_connection(self) -> None:
        self.connection.close()

    def execute_query(self, query:str, timeout:int=None, raise_exception:bool= False, finished_callback=None ):
        records, summary, keys = self.driver.execute_query(query,  {},
                                                        database_="neo4j",
                                                        routing_=neo4j.RoutingControl.READERS)
 
        return records