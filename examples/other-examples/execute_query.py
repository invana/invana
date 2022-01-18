import os
import asyncio
from invana_py import InvanaGraph

GREMLIN_SERVER_URL = os.environ.get("GREMLIN_SERVER_URL", "ws://localhost:8182/gremlin")


async def main():
    print("===test execute query")
    graph = InvanaGraph(GREMLIN_SERVER_URL)
    graph.g.V().toList()
    data = graph.execute_query("g.V().limit(1).count()")
    # data =  connector.vertex.read_many()
    print("======data", data)
    graph.close_connection()


# loop = asyncio.get_event_loop()
# loop.run_until_complete(main())
# loop.close()
asyncio.run(main())
