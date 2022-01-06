import uuid
from datetime import datetime


def create_uuid():
    return uuid.uuid4().__str__()


def get_elapsed_time(start_time, end_time):
    return (end_time - start_time).total_seconds()


def get_datetime():
    return datetime.now()
