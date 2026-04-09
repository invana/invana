#!/usr/bin/env python3
"""
Air Routes Dataset Generator

Converts the Krlawrence graph air-routes data from GitHub into Invana's
gold standard CSV format with separate files for each node/edge label.

Source: https://github.com/krlawrence/graph/tree/main/sample-data
- air-routes-latest-nodes.csv
- air-routes-latest-edges.csv

Usage:
    python generate_dataset.py
"""

import logging
import os
import sys
from pathlib import Path

import pandas as pd
import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


class AirRoutesDatasetGenerator:
    """Generate air-routes dataset in Invana gold standard format."""

    def __init__(self, output_dir: str = None):
        if output_dir is None:
            output_dir = Path(__file__).parent

        self.output_dir = Path(output_dir)
        self.nodes_dir = self.output_dir / "nodes"
        self.edges_dir = self.output_dir / "relationships"

        # Source URLs
        self.nodes_url = (
            "https://raw.githubusercontent.com/krlawrence/graph/main/sample-data/air-routes-latest-nodes.csv"
        )
        self.edges_url = (
            "https://raw.githubusercontent.com/krlawrence/graph/main/sample-data/air-routes-latest-edges.csv"
        )

        # Create directories
        self.nodes_dir.mkdir(parents=True, exist_ok=True)
        self.edges_dir.mkdir(parents=True, exist_ok=True)

    def download_source_data(self):
        """Download source CSV files from GitHub."""
        logger.info("📥 Downloading source data from GitHub...")

        try:
            # Download nodes
            logger.info(f"  • Downloading nodes from: {self.nodes_url}")
            nodes_response = requests.get(self.nodes_url, timeout=30)
            nodes_response.raise_for_status()

            nodes_file = self.output_dir / "air-routes-nodes-source.csv"
            with open(nodes_file, "w", encoding="utf-8") as f:
                f.write(nodes_response.text)
            logger.info(f"  ✅ Nodes saved to: {nodes_file}")

            # Download edges
            logger.info(f"  • Downloading edges from: {self.edges_url}")
            edges_response = requests.get(self.edges_url, timeout=30)
            edges_response.raise_for_status()

            edges_file = self.output_dir / "air-routes-edges-source.csv"
            with open(edges_file, "w", encoding="utf-8") as f:
                f.write(edges_response.text)
            logger.info(f"  ✅ Edges saved to: {edges_file}")

            logger.info("✅ Source data downloaded successfully")

        except requests.RequestException as e:
            logger.error(f"❌ Failed to download source data: {e}")
            raise
        except Exception as e:
            logger.error(f"❌ Error saving source data: {e}")
            raise

    def process_nodes(self):
        """Process nodes CSV into separate files by label."""
        logger.info("🔄 Processing nodes by label...")

        try:
            # Read source nodes
            nodes_file = self.output_dir / "air-routes-nodes-source.csv"
            nodes_df = pd.read_csv(nodes_file)
            logger.info(f"  • Loaded {len(nodes_df)} nodes from source")

            # Check available labels
            labels = nodes_df["~label"].unique()
            logger.info(f"  • Found node labels: {list(labels)}")

            # Group by label and process each type
            for label in labels:
                group_df = nodes_df[nodes_df["~label"] == label]
                self._process_node_group(label, group_df)

        except Exception as e:
            logger.error(f"❌ Failed to process nodes: {e}")
            raise

    def _process_node_group(self, label: str, df: pd.DataFrame):
        """Process a specific node label group."""
        logger.info(f"  📄 Processing {len(df)} {label} nodes...")

        # Build output DataFrame with gold standard format
        output_rows = []

        for _, row in df.iterrows():
            output_row = {"Id": row["~id"], "Label": label}

            # Convert all other columns to Properties:* format
            for col, value in row.items():
                if col not in ["~id", "~label"] and pd.notna(value):
                    # Clean column name for property
                    prop_name = col.replace("~", "").replace(":", "_")
                    output_row[f"Properties:{prop_name}"] = value

            output_rows.append(output_row)

        # Create DataFrame and save
        output_df = pd.DataFrame(output_rows)
        output_file = self.nodes_dir / f"{label.lower()}.csv"
        output_df.to_csv(output_file, index=False)

        logger.info(f"    ✅ Created {output_file.name} with {len(output_df)} {label} nodes")

    def process_edges(self):
        """Process edges CSV into separate files by label."""
        logger.info("🔄 Processing edges by label...")

        try:
            # Read source edges
            edges_file = self.output_dir / "air-routes-edges-source.csv"
            edges_df = pd.read_csv(edges_file)
            logger.info(f"  • Loaded {len(edges_df)} edges from source")

            # Check available labels
            labels = edges_df["~label"].unique()
            logger.info(f"  • Found edge labels: {list(labels)}")

            # Group by label and process each type
            for label in labels:
                group_df = edges_df[edges_df["~label"] == label]
                self._process_edge_group(label, group_df)

        except Exception as e:
            logger.error(f"❌ Failed to process edges: {e}")
            raise

    def _process_edge_group(self, label: str, df: pd.DataFrame):
        """Process a specific edge label group."""
        logger.info(f"  🔗 Processing {len(df)} {label} edges...")

        # Build output DataFrame with gold standard format
        output_rows = []

        for _, row in df.iterrows():
            output_row = {"Id": row["~id"], "Label": label, "FromId": row["~from"], "ToId": row["~to"]}

            # Convert all other columns to Properties:* format
            for col, value in row.items():
                if col not in ["~id", "~label", "~from", "~to"] and pd.notna(value):
                    # Clean column name for property
                    prop_name = col.replace("~", "").replace(":", "_")
                    output_row[f"Properties:{prop_name}"] = value

            output_rows.append(output_row)

        # Create DataFrame and save
        output_df = pd.DataFrame(output_rows)
        output_file = self.edges_dir / f"{label.lower()}.csv"
        output_df.to_csv(output_file, index=False)

        logger.info(f"    ✅ Created {output_file.name} with {len(output_df)} {label} edges")

    def create_readme(self):
        """Create README.md for the dataset."""
        readme_content = """# Air Routes Dataset

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
"""

        readme_file = self.output_dir / "README.md"
        with open(readme_file, "w", encoding="utf-8") as f:
            f.write(readme_content)

        logger.info(f"📖 Created {readme_file.name}")

    def generate_dataset(self):
        """Generate the complete air-routes dataset."""
        logger.info("🚀 Generating Air Routes Dataset...")

        try:
            # Download source data
            self.download_source_data()

            # Process nodes and edges
            self.process_nodes()
            self.process_edges()

            # Create documentation
            self.create_readme()

            # Print summary before cleanup
            self._print_summary()

            # Clean up source files
            source_nodes = self.output_dir / "air-routes-nodes-source.csv"
            source_edges = self.output_dir / "air-routes-edges-source.csv"

            if source_nodes.exists():
                os.remove(source_nodes)
            if source_edges.exists():
                os.remove(source_edges)

            logger.info("🧹 Cleaned up temporary source files")
            logger.info("🎉 Air Routes Dataset generated successfully!")

        except Exception as e:
            logger.error(f"❌ Dataset generation failed: {e}")
            sys.exit(1)

    def _print_summary(self):
        """Print dataset summary."""
        logger.info("\n📊 Dataset Generation Summary:")
        logger.info("=" * 50)

        total_nodes = 0
        total_edges = 0

        # Count nodes
        logger.info("📄 Node Files:")
        for node_file in sorted(self.nodes_dir.glob("*.csv")):
            try:
                df = pd.read_csv(node_file)
                label = node_file.stem.title()
                count = len(df)
                total_nodes += count
                logger.info(f"  • {label:12} : {count:,} nodes")
            except Exception as e:
                logger.warning(f"  ⚠️  {node_file.name}: Error reading file - {e}")

        # Count edges
        logger.info("\n🔗 Edge Files:")
        for edge_file in sorted(self.edges_dir.glob("*.csv")):
            try:
                df = pd.read_csv(edge_file)
                label = edge_file.stem.title()
                count = len(df)
                total_edges += count
                logger.info(f"  • {label:12} : {count:,} edges")
            except Exception as e:
                logger.warning(f"  ⚠️  {edge_file.name}: Error reading file - {e}")

        logger.info("=" * 50)
        logger.info(f"📈 Total Nodes: {total_nodes:,}")
        logger.info(f"📈 Total Edges: {total_edges:,}")
        logger.info(f"📂 Output Directory: {self.output_dir}")


if __name__ == "__main__":
    generator = AirRoutesDatasetGenerator()
    generator.generate_dataset()
