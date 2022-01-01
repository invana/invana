#   Copyright 2021 Invana
#  #
#    Licensed under the Apache License, Version 2.0 (the "License");
#    you may not use this file except in compliance with the License.
#    You may obtain a copy of the License at
#  #
#    http:www.apache.org/licenses/LICENSE-2.0
#  #
#    Unless required by applicable law or agreed to in writing, software
#   distributed under the License is distributed on an "AS IS" BASIS,
#    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#    See the License for the specific language governing permissions and
#    limitations under the License.
#
from .querysets import VertexQuerySet, EdgeQuerySet
from .utils import convert_to_camel_case


class ModelBase(type):

    def __new__(cls, name, bases, attrs):
        super_new = super().__new__
        # Also ensure initialization is only performed for subclasses of Model
        # (excluding Model class itself).
        parents = [b for b in bases if isinstance(b, ModelBase)]
        if not parents:
            return super_new(cls, name, bases, attrs)
        model_base_cls = bases[0]
        if "name" not in attrs:
            attrs['label_name'] = name if model_base_cls.__name__ == "VertexModel" else convert_to_camel_case(name)
        model_class = super_new(cls, name, bases, attrs)
        model_class.objects = model_base_cls.objects(attrs['gremlin_connector'], model_class)
        return model_class


class VertexModel(metaclass=ModelBase):
    """
    class Meta:
        gremlin_connector = None
    """
    objects = VertexQuerySet
    label_name = None


class EdgeModel(metaclass=ModelBase):
    objects = EdgeQuerySet
    label_name = None
