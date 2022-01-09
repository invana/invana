from concurrent.futures import Future
from .response import Response


def read_from_result_set_with_callback(result_set, callback, request, finished_callback):
    def cb(f):
        try:
            f.result()
        except Exception as e:
            raise e
        else:
            while not result_set.stream.empty():
                single_result = result_set.stream.get_nowait()
                callback(Response(request.request_id, 206, data=single_result))
                request.response_received_successfully(206)
            request.finished_with_success()

    result_set.done.add_done_callback(cb)

    if finished_callback:
        finished_callback()


def read_from_result_set_with_out_callback(result_set, request):
    future = Future()

    def cb(f):
        try:
            f.result()
        except Exception as e:
            future.set_exception(e)
        else:
            results = []

            while not result_set.stream.empty():
                results += result_set.stream.get_nowait()
            future.set_result(Response(request.request_id, 200, data=results))
            request.response_received_successfully(200)
            request.finished_with_success()

    result_set.done.add_done_callback(cb)
    return future.result()


def get_id(_id):
    if isinstance(_id, dict):
        if isinstance(_id.get('@value'), dict) and _id.get("@value").get('relationId'):
            return _id.get('@value').get('relationId')
        else:
            return _id.get('@value')
    return _id
