import logging
from .graph import InvanaGraph

logging.getLogger('asyncio').setLevel(logging.INFO)
logging.basicConfig(
    handlers=[logging.StreamHandler()],  # logging.FileHandler("job.log", mode='w'),
    format='[%(levelname)s:%(asctime)s:%(module)s.%(funcName)s:%(lineno)d] - %(message)s',
    level=logging.DEBUG
)
