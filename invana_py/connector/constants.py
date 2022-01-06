class RequestStateTypes:
    STARTED = "STARTED"
    RESPONSE_RECEIVED = "RESPONSE_RECEIVED"  # this status can be many for async execution
    FINISHED = "FINISHED"

    @classmethod
    def get_allowed_types(cls):
        return [k for k in list(cls.__dict__.keys()) if not k.startswith("__") and k.isupper()]


class QueryResponseStatusTypes:
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"

    @classmethod
    def get_allowed_types(cls):
        return [k for k in list(cls.__dict__.keys()) if not k.startswith("__") and k.isupper()]


class QueryResponseErrorReasonTypes:
    # theses are error statuses when query response is received
    TIMED_OUT = "TIMED_OUT"
    INVALID_QUERY = "INVALID_QUERY"
    OTHER = "OTHER"

    @classmethod
    def get_allowed_types(cls):
        return [k for k in list(cls.__dict__.keys()) if not k.startswith("__") and k.isupper()]


class GremlinServerErrorStatusCodes:
    ERROR_401 = "UNAUTHORIZED"
    ERROR_403 = "FORBIDDEN"
    ERROR_407 = "AUTHENTICATE"
    ERROR_497 = "REQUEST ERROR SERIALIZATION"
    ERROR_498 = "REQUEST ERROR MALFORMED REQUEST"
    ERROR_499 = "REQUEST ERROR INVALID REQUEST ARGUMENTS"
    ERROR_500 = "SERVER ERROR"
    ERROR_596 = "SERVER ERROR TEMPORARY"
    ERROR_597 = "SERVER ERROR EVALUATION"
    ERROR_598 = "SERVER ERROR TIMEOUT"
    ERROR_599 = "SERVER ERROR SERIALIZATION"


class ConnectionStateTypes:
    CONNECTED = "CONNECTED"
    CONNECTING = "CONNECTING"
    RECONNECTING = "RECONNECTING"
    DISCONNECTING = "DISCONNECTING"
    DISCONNECTED = "DISCONNECTED"
