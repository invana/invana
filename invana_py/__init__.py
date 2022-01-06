import logging

logging.getLogger('asyncio').setLevel(logging.INFO)
logging.basicConfig(
    handlers=[logging.FileHandler("job.log", mode='w'), logging.StreamHandler()],
    format='[%(levelname)s:%(asctime)s:%(module)s.%(funcName)s:%(lineno)d] - %(message)s',
    level=logging.DEBUG
)
