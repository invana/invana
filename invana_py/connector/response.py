class Response:

    def __init__(self, request_id, data, status_code):
        self.request_id = request_id
        self.data = data
        self.status_code = status_code

    def __repr__(self):
        return f"<Response:{self.request_id} status_code={self.status_code}>"
