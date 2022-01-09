from invana_py.ogm.exceptions import ValidationError
from ..serializer.element_structure import Node, RelationShip


def dont_allow_has_label_kwargs(**query_kwargs):
    keys = list(query_kwargs.keys())
    for k in keys:
        if k.startswith("has__label"):
            raise ValidationError("has__label search kwargs not allowed when using OGM")


def serialize_data(f):
    def wrapper(self, *args, **kwargs):
        result = f(self, *args, **kwargs)
        return serialize_to_datatypes(self, result)

    return wrapper


def serialize_to_datatypes(self, element):
    if isinstance(element, list):
        return [serialize_to_datatypes(self, res) for res in element]
    elif element and (isinstance(element, Node) or isinstance(element, RelationShip)):
        for k, field in self.model.properties.items():
            if hasattr(element.properties, k):
                _ = self.get_validated_data(k, getattr(element.properties, k), self.model)
                setattr(element.properties, k, _)
        return element
    return element
