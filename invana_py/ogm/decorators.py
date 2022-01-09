from invana_py.ogm.exceptions import ValidationError


def dont_allow_has_label_kwargs(**query_kwargs):
    keys = list(query_kwargs.keys())
    for k in keys:
        if k.startswith("has__label"):
            raise ValidationError("has__label search kwargs not allowed when using OGM")
