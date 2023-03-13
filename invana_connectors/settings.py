import os 

GRAPH_CONNECTION_URL = os.environ.get("GRAPH_CONNECTION_URL" , "ws://megamind-ws:8182/gremlin")
GRAPH_BACKEND = os.environ.get("")
DEFAULT_TIMEOUT = 180 * 1000  # in seconds
