from ..utils import create_uuid, get_elapsed_time, get_datetime

class RequestBase:

    created_at = None
    request_id = None
    status_last_updated_at = None

    def __init__(self):
        self.request_id = create_uuid()
        self.created_at = get_datetime()
        self.status_last_updated_at = None

    def get_elapsed_time(self):
        return get_elapsed_time(get_datetime(), self.created_at)

    def update_last_updated_at(self):
        self.status_last_updated_at = get_datetime()


class ResponseBase:

    request_id = None
    data = None
    status_code = None
    exception = None
    created_at = None

    def __init__(self, request_id, status_code, data=None, exception=None):
        self.request_id = request_id
        self.data = data
        self.status_code = status_code
        self.exception = exception
        self.created_at = get_datetime()

    def is_success(self):
        return False if self.exception else True

    def __repr__(self):
        return f"<Response:{self.request_id} status_code={self.status_code}>"
