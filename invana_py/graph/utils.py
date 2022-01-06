


def read_from_result_set_with_callback(result_set, callback, finished_callback):
    def cb(f):
        try:
            f.result()
        except Exception as e:
            raise e
        else:
            while not result_set.stream.empty():
                single_result = result_set.stream.get_nowait()
                callback(single_result)

    result_set.done.add_done_callback(cb)

    if finished_callback:
        finished_callback()


