# invana-py

Python API for modelling and querying graph data. 

1. [Modelling graph](#modelling-graph)
2. [Creating Nodes & Relationships](#creating-nodes--relationships)
3. [Querysets](#queryset)

## Modelling graph

```python
from invana.ogm.models import NodeModel, RelationshipModel, RelationshipTo, RelationshipFrom
from invana.ogm.properties import StringProperty, DateTimeProperty
from invana.ogm.relationships.cardinality import Multi, Simple, Many2One, One2Many, One2One
from invana.ogm import indexes
from invana.queryset import NodeModalQuerySet, RelationshipModalQuerySet


class LivesIn(RelationshipModel):
    since = DateTimeProperty(default_now=True)

    __indexes__ = (indexes.CompositeIndex("since"),)


class NodeBase(NodeModel):
    name = StringProperty(property_name="name", required=True)

    __abstract__ = True
    __indexes__ = (indexes.CompositeIndex("name"),)


class Location(NodeBase):
    residents = RelationshipTo('Person', LivesIn, cardinality=Multi)


class Person(NodeBase):
    age = StringProperty()
    lives_in = RelationshipTo(Location, LivesIn, cardinality=Multi)
```

## Creating Nodes & Relationships

```python
ravi = Person.objects.create(name="Ravi")
mars = Location.objects.create(name="Mars")

# CRUD on relationships
ravi.lives_in.connect(mars, since=2020) # create link 
ravi.lives_in.is_connected(mars) # check if link exist
ravi.lives_in.update_connection(mars, since=2021) #update the link properties
ravi.lives_in.disconnect(mars) # remove link
```


## Queryset

```python
# create
Person.objects.create(name="Rudra")
rudra = Person(name="Rudra").save()

# read
Person.objects.get(id=109)
Person.objects.get_or_none(id=109)
Person.objects.filter(has__name="Ravi")
Person.objects.filter(has__name="Ravi").first()
Person.objects.filter(has__name="Ravi").order_by("-name").limit(10)
Person.objects.all()


# update
Person.objects.filter(has__name__contains="Revi").update(name="Ravi")
ravi = Person.objects.filter(has__name="Revi")
ravi.name = "Rudransh"
ravi.save()


# delete
Person.objects.filter(id__in=[109, 108, 112]).delete()
ravi = Person.objects.get(id=112)
ravi.delete()
Person.objects.all().delete()

# others
Person.objects.get_or_update(name="Ravi")
Person.objects.get_or_create(name="Ravi")
```

 
 