# Air Routes Dataset

This dataset contains global airport and flight route data in Invana's gold standard CSV format.

## Source
Original data from: https://github.com/krlawrence/graph/tree/main/sample-data
- air-routes-latest-nodes.csv
- air-routes-latest-edges.csv

Generated using Invana's gold standard CSV format with separate files for each node/edge label.

## Dataset Structure

### Nodes Directory
- **airport.csv** - Global airports with codes, names, locations, and metadata
- **country.csv** - Countries with names and metadata
- **continent.csv** - Continents with names and codes

### Edges Directory
- **route.csv** - Flight routes between airports with distance and metadata
- **contains.csv** - Hierarchical relationships (country-continent, airport-country)

## Gold Standard Format

All CSV files follow Invana's gold standard format:

### Node Files
```csv
Id,Label,Properties:code,Properties:desc,Properties:city,...
NODE_001,Airport,LAX,Los Angeles International,Los Angeles,...
```

### Edge Files
```csv
Id,Label,FromId,ToId,Properties:dist,Properties:type,...
EDGE_001,Route,NODE_001,NODE_002,2345,domestic,...
```

## Schema Overview

### Airport Nodes
- **Properties**: code, icao, iata, city, desc, region, runways, longest, elev, country, lat, lon

### Country Nodes
- **Properties**: code, desc

### Continent Nodes
- **Properties**: code, desc

### Route Edges
- **Properties**: dist (distance in miles)

### Contains Edges
- Hierarchical containment relationships (no additional properties)

## Usage with Invana CSV Loader

```python
from invana.graph.loaders import LoaderFactory

# Configure loader
loader = LoaderFactory.create_loader('gremlin', connector, config)

# Load nodes (order matters for relationships)
await loader.load_from_file('datasets/air-routes/nodes/continent.csv')
await loader.load_from_file('datasets/air-routes/nodes/country.csv')
await loader.load_from_file('datasets/air-routes/nodes/airport.csv')

# Load relationships
await loader.load_from_file('datasets/air-routes/edges/contains.csv')
await loader.load_from_file('datasets/air-routes/edges/route.csv')
```

## Dataset Statistics
- **Airports**: ~3,500 global airports
- **Countries**: ~240 countries
- **Continents**: 7 continents
- **Routes**: ~50,000+ flight routes
- **Contains**: Hierarchical relationships

## Use Cases
This dataset is ideal for:
- Graph traversal algorithms
- Shortest path routing between airports
- Geographic network analysis
- Network topology studies
- Performance testing of graph databases
- Graph algorithm development and testing

## Data Quality
- Real-world airport codes (IATA, ICAO)
- Geographic coordinates for spatial queries
- Distance calculations for route optimization
- Hierarchical structure for containment queries
