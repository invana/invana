from invana.helpers.utils import create_uuid, get_elapsed_time, get_datetime

class RequestBase:
    created_at = None

    def __init__(self):
        self.request_id = create_uuid()
        self.created_at = get_datetime()
        self.status_last_updated_at = None

    def get_elapsed_time(self):
        return get_elapsed_time(get_datetime(), self.created_at)

    def update_last_updated_at(self):
        self.status_last_updated_at = get_datetime()
