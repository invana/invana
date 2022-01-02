#    Copyright 2021 Invana
#
#     Licensed under the Apache License, Version 2.0 (the "License");
#     you may not use this file except in compliance with the License.
#     You may obtain a copy of the License at
#
#     http:www.apache.org/licenses/LICENSE-2.0
#
#     Unless required by applicable law or agreed to in writing, software
#    distributed under the License is distributed on an "AS IS" BASIS,
#     WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#     See the License for the specific language governing permissions and
#     limitations under the License.

"""
~id,~label,type:string,code:string,icao:string,desc:string,region:string,
runways:int,longest:int,elev:int,country:string,city:string,lat:double,lon:double,author:string,date:string

"""
from gremlin_connector.ogm.models import VertexModel, EdgeModel
from connection import gremlin_connector
from gremlin_connector.ogm.fields import StringProperty, IntegerProperty, DateTimeProperty, FloatProperty


class Airport(VertexModel):
    gremlin_connector = gremlin_connector
    properties = {
        "type": StringProperty(),
        "code": StringProperty(),
        "icao": StringProperty(),
        "desc": StringProperty(),
        "region": StringProperty(),
        "runways": IntegerProperty(),
        "longest": IntegerProperty(),
        "elev": IntegerProperty(),
        "country": StringProperty(),
        "city": StringProperty(),
        "lat": FloatProperty(),
        "lon": FloatProperty(),
    }


class Version(VertexModel):
    gremlin_connector = gremlin_connector
    properties = {
        "code": StringProperty(),
        "desc": StringProperty(),
        "author": StringProperty(),
        "date": DateTimeProperty(),
    }


class Route(EdgeModel):
    gremlin_connector = gremlin_connector
    properties = {
        'dist': IntegerProperty()
    }
