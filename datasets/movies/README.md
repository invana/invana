# Movies Dataset - Invana Gold Standard Format

This dataset contains movie and person data in the Invana gold standard CSV format, based on the classic Neo4j movies database.

## 🎬 Dataset Overview

### Nodes
- **Person** (50 records): Actors, directors, producers, and screenwriters
- **Movie** (30 records): Popular movies from 1986-2012

### Relationships
- **ACTED_IN** (50 records): Actors and their movie roles with character names
- **DIRECTED** (20 records): Directors and their movies
- **PRODUCED** (15 records): Producers and their movies
- **WROTE** (13 records): Screenwriters and their screenplays
- **FOLLOWS** (15 records): Professional relationships between people
- **REVIEWED** (10 records): Movie reviews with ratings and summaries

## 📊 Dataset Statistics

| Type | Count | Description |
|------|-------|-------------|
| **Total Nodes** | **80** | 50 Person + 30 Movie |
| **Total Relationships** | **123** | 6 different relationship types |
| **Time Period** | 1986-2012 | Classic and modern movies |
| **Genres** | Multiple | Sci-Fi, Drama, Action, Comedy, Romance, etc. |

## 🏆 Featured Movies

### The Matrix Trilogy
- The Matrix (1999) - *"Welcome to the Real World"*
- The Matrix Reloaded (2003) - *"Free your mind"*
- The Matrix Revolutions (2003) - *"Everything that has a beginning has an end"*

### Classic Dramas
- A Few Good Men (1992) - *"You can't handle the truth!"*
- The Green Mile (1999) - *"Walk a mile you'll never forget"*
- Stand By Me (1986) - *"For some, the greatest adventure is simply growing up"*

### Romantic Comedies
- You've Got Mail (1998) - *"At odds in life... in love on-line"*
- Sleepless in Seattle (1993) - *"What if someone you never met..."*
- When Harry Met Sally (1989) - *"Can two friends sleep together..."*

## 🌟 Notable People

### Actors
- **Keanu Reeves** - Neo in The Matrix trilogy
- **Tom Hanks** - Multiple romantic comedies and dramas
- **Al Pacino** - Legendary performances in drama films
- **Jack Nicholson** - Iconic roles across multiple decades

### Directors
- **Wachowski Sisters (Lilly & Lana)** - The Matrix trilogy creators
- **Rob Reiner** - Multiple classic films spanning genres
- **Tom Hanks** - Actor-director (That Thing You Do!)

## 📁 File Structure

```
nodes/
├── person.csv          # 50 people (actors, directors, producers)
└── movie.csv           # 30 movies with metadata

relationships/
├── acted_in.csv        # 50 acting relationships
├── directed.csv        # 20 directing relationships
├── produced.csv        # 15 producing relationships
├── wrote.csv           # 13 screenwriting relationships
├── follows.csv         # 15 professional connections
└── reviewed.csv        # 10 movie reviews
```

## 🔗 Gold Standard Format

### Node Format
```csv
Id,Label,Properties:name,Properties:born,Properties:bio
PERSON_1,Person,Keanu Reeves,1964,Canadian actor known for action films
```

### Relationship Format
```csv
Id,Label,FromId,ToId,Properties:roles,Properties:year,Properties:character_name
REL_ACTED_1,ACTED_IN,PERSON_1,MOVIE_1,Neo,1999,Neo
```

## 🚀 Usage Examples

### Load with Invana CSV Loader
```python
from invana.graph.loaders import LoaderFactory, CypherLoaderConfig
from invana.graph.connectors.languages.cypher.connector import CypherConnector

config = {'url': 'bolt://localhost:7687', 'username': 'neo4j', 'password': 'password'}
loader_config = CypherLoaderConfig(batch_size=50, clean_database=True)

connector = CypherConnector(config)
await connector.connect()

loader = LoaderFactory.create_loader('cypher', connector, loader_config)
async with loader:
    await loader.load_from_directory('datasets/movies')
```

### Sample Queries

#### Find all movies starring Keanu Reeves
```cypher
MATCH (p:Person {name: 'Keanu Reeves'})-[r:ACTED_IN]->(m:Movie)
RETURN m.title, r.character_name, m.released
ORDER BY m.released
```

#### Find directors who also acted
```cypher
MATCH (p:Person)-[:DIRECTED]->(m1:Movie)
MATCH (p)-[:ACTED_IN]->(m2:Movie)
RETURN p.name, collect(DISTINCT m1.title) as directed, collect(DISTINCT m2.title) as acted_in
```

#### Find the highest-rated movies
```cypher
MATCH (p:Person)-[r:REVIEWED]->(m:Movie)
RETURN m.title, AVG(r.rating) as avg_rating, count(r) as review_count
ORDER BY avg_rating DESC, review_count DESC
```

## 🎯 Use Cases

1. **Graph Database Learning**: Perfect for learning graph traversals and patterns
2. **Recommendation Systems**: Build movie and person recommendation engines
3. **Social Network Analysis**: Analyze professional relationships in Hollywood
4. **Data Pipeline Testing**: Test ETL processes with realistic entertainment data
5. **Query Performance Testing**: Benchmark graph database performance
6. **GraphQL Schema Design**: Design entertainment industry APIs

## 📊 Data Quality

- **✅ Complete Referential Integrity**: All relationship FromId/ToId reference valid nodes
- **✅ Rich Metadata**: Movies include taglines, genres, release years, runtime
- **✅ Realistic Relationships**: Based on actual movie industry connections
- **✅ Diverse Data Types**: Strings, integers, dates, and lists
- **✅ Gold Standard Compliance**: Follows Invana CSV format specifications

## 🔍 Data Sources

Based on the classic Neo4j movie database with enhancements:
- Official movie metadata from IMDb/TMDb
- Professional relationships from entertainment industry databases
- Review data simulated for demonstration purposes
- Biographical information from public entertainment sources

---

*This dataset is provided for educational and testing purposes. All movie and person data is publicly available information.*
