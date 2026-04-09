#!/usr/bin/env python3
"""
Air Routes Dataset Usage Example

Shows how to use the generated air-routes dataset with Invana CSV loaders.
This is a reference implementation for loading the dataset.
"""

from pathlib import Path

# This would be the usage pattern (commented out since we don't want to run tests)
"""
# Example usage with Invana CSV Loader
from invana.graph.loaders import LoaderFactory
from invana.graph.connectors.languages.gremlin.connector import GremlinConnector

async def load_air_routes_dataset():
    # Configure your database connection
    connector_config = {
        'url': 'ws://localhost:8182/gremlin',
        'username': 'root',
        'password': 'playwithdata'
    }

    # Create loader
    loader = LoaderFactory.create_loader('gremlin', connector_config)

    # Dataset paths
    dataset_dir = Path("datasets/air-routes")
    nodes_dir = dataset_dir / "nodes"
    edges_dir = dataset_dir / "edges"

    try:
        # Load nodes first (order matters for relationships)
        print("📄 Loading nodes...")

        continent_count = await loader.load_from_file(str(nodes_dir / "continent.csv"))
        print(f"✅ Loaded {continent_count} continents")

        country_count = await loader.load_from_file(str(nodes_dir / "country.csv"))
        print(f"✅ Loaded {country_count} countries")

        airport_count = await loader.load_from_file(str(nodes_dir / "airport.csv"))
        print(f"✅ Loaded {airport_count} airports")

        # Load relationships
        print("🔗 Loading relationships...")

        contains_count = await loader.load_from_file(str(edges_dir / "contains.csv"))
        print(f"✅ Loaded {contains_count} contains relationships")

        route_count = await loader.load_from_file(str(edges_dir / "route.csv"))
        print(f"✅ Loaded {route_count} route relationships")

        # Summary
        total_nodes = continent_count + country_count + airport_count
        total_edges = contains_count + route_count

        print(f"\\n📊 Total Loaded:")
        print(f"  • Nodes: {total_nodes:,}")
        print(f"  • Relationships: {total_edges:,}")

    finally:
        await loader.connector.disconnect()

if __name__ == "__main__":
    asyncio.run(load_air_routes_dataset())
"""


def show_dataset_info():
    """Display information about the generated dataset."""

    print("🌍 Air Routes Dataset - Usage Information")
    print("=" * 60)

    dataset_dir = Path(__file__).parent
    nodes_dir = dataset_dir / "nodes"
    edges_dir = dataset_dir / "edges"

    print(f"📂 Dataset Location: {dataset_dir}")
    print(f"📂 Nodes Directory: {nodes_dir}")
    print(f"📂 Edges Directory: {edges_dir}")

    print("\n📊 Dataset Statistics:")

    # Count files and show structure
    if nodes_dir.exists():
        print("\n📄 Node Files:")
        for node_file in sorted(nodes_dir.glob("*.csv")):
            try:
                # Count lines (minus header)
                with open(node_file) as f:
                    line_count = sum(1 for _ in f) - 1
                print(f"  • {node_file.name:15} : {line_count:,} nodes")
            except Exception as e:
                print(f"  • {node_file.name:15} : Error reading - {e}")

    if edges_dir.exists():
        print("\n🔗 Edge Files:")
        for edge_file in sorted(edges_dir.glob("*.csv")):
            try:
                # Count lines (minus header)
                with open(edge_file) as f:
                    line_count = sum(1 for _ in f) - 1
                print(f"  • {edge_file.name:15} : {line_count:,} edges")
            except Exception as e:
                print(f"  • {edge_file.name:15} : Error reading - {e}")

    print("\n🚀 Loading Order (Recommended):")
    print("  1. continent.csv   (base hierarchy)")
    print("  2. country.csv     (country nodes)")
    print("  3. airport.csv     (airport nodes)")
    print("  4. contains.csv    (hierarchy relationships)")
    print("  5. route.csv       (route relationships)")

    print("\n💡 Usage Tips:")
    print("  • Load nodes before relationships")
    print("  • Contains edges create hierarchy (continent->country->airport)")
    print("  • Route edges connect airports directly")
    print("  • Geographic coordinates enable spatial queries")
    print("  • Real airport codes (IATA/ICAO) for real-world relevance")

    print("\n🔍 Sample Queries (after loading):")
    print("  • Find all airports in a country")
    print("  • Calculate shortest path between airports")
    print("  • Find routes by distance range")
    print("  • Analyze airport connectivity (hub vs spoke)")
    print("  • Geographic proximity analysis")

    print("\n📖 Documentation: See README.md for complete details")
    print("=" * 60)


if __name__ == "__main__":
    show_dataset_info()
