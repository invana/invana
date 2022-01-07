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
                callback(Response(request.request_id, single_result, 206))
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
            future.set_result(Response(request.request_id, results, 200))
            request.response_received_successfully(200)
            request.finished_with_success()

    result_set.done.add_done_callback(cb)
    return future.result()
