

def raise_exception_if_needed(response):
    if response.status_code >= 200 and response.status_code < 300:
        pass
    else:
        raise response.exception
