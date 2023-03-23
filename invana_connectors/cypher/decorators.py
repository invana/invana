from .serializer  import convert_neomodel_response_to_invana_objects

def serialize_neomodel_to_invana_objects(func):
    def inner1(*args, **kwargs):
        # getting the returned value
        returned_value = func(*args, **kwargs)
        # returning the value to the original frame
        return convert_neomodel_response_to_invana_objects(returned_value)
         
    return inner1