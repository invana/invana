#  Copyright 2020 Invana
#
#   Licensed under the Apache License, Version 2.0 (the "License");
#   you may not use this file except in compliance with the License.
#   You may obtain a copy of the License at
#
#   http:www.apache.org/licenses/LICENSE-2.0
#
#   Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#   See the License for the specific language governing permissions and
#   limitations under the License.

from gremlin_driver.gremlin import GremlinClient
from gremlin_driver.typing import ResponseMessage

driver = GremlinClient("ws://localhost:8182/gremlin")
query_string = """
g.addV('Person').property('first_name', 'Ravi').property('last_name', 'M').as('ravi').
   addV('Company').property('name', 'Invana').property('about', 'Invana is a Knowledge Graphs company').as('invana'). 
   addE('founded').from('ravi').to('invana').property("year", "2017").property("capital", "a penny").
   iterate()
"""
# query_string = "g.V().drop()"
elems = driver.execute_query_as_sync(query_string)
print(elems)
