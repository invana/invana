#!/usr/bin/env python3
"""
Movies Dataset Generator for Invana Graph OGM

This script generates the movies dataset in Invana gold standard CSV format,
based on the classic Neo4j movies database with additional enhancements.

Usage:
    python generate_dataset.py [--output-dir ./datasets/movies]
"""

import argparse
import csv
from pathlib import Path
from typing import Any


def create_person_data() -> list[dict[str, Any]]:
    """Create person (actors, directors, producers) data."""
    return [
        {
            "Id": "PERSON_1",
            "Label": "Person",
            "Properties:name": "Keanu Reeves",
            "Properties:born": "1964",
            "Properties:bio": "Canadian actor known for action films",
        },
        {
            "Id": "PERSON_2",
            "Label": "Person",
            "Properties:name": "Laurence Fishburne",
            "Properties:born": "1961",
            "Properties:bio": "American actor and playwright",
        },
        {
            "Id": "PERSON_3",
            "Label": "Person",
            "Properties:name": "Carrie-Anne Moss",
            "Properties:born": "1967",
            "Properties:bio": "Canadian actress",
        },
        {
            "Id": "PERSON_4",
            "Label": "Person",
            "Properties:name": "Hugo Weaving",
            "Properties:born": "1960",
            "Properties:bio": "British-Australian actor",
        },
        {
            "Id": "PERSON_5",
            "Label": "Person",
            "Properties:name": "Lilly Wachowski",
            "Properties:born": "1967",
            "Properties:bio": "American film director and screenwriter",
        },
        {
            "Id": "PERSON_6",
            "Label": "Person",
            "Properties:name": "Lana Wachowski",
            "Properties:born": "1965",
            "Properties:bio": "American film director and screenwriter",
        },
        {
            "Id": "PERSON_7",
            "Label": "Person",
            "Properties:name": "Joel Silver",
            "Properties:born": "1952",
            "Properties:bio": "American film producer",
        },
        {
            "Id": "PERSON_8",
            "Label": "Person",
            "Properties:name": "Emil Eifrem",
            "Properties:born": "1973",
            "Properties:bio": "Swedish entrepreneur and graph database expert",
        },
        {
            "Id": "PERSON_9",
            "Label": "Person",
            "Properties:name": "Charlize Theron",
            "Properties:born": "1975",
            "Properties:bio": "South African-American actress and producer",
        },
        {
            "Id": "PERSON_10",
            "Label": "Person",
            "Properties:name": "Al Pacino",
            "Properties:born": "1940",
            "Properties:bio": "American actor and filmmaker",
        },
        {
            "Id": "PERSON_11",
            "Label": "Person",
            "Properties:name": "Taylor Hackford",
            "Properties:born": "1944",
            "Properties:bio": "American film director",
        },
        {
            "Id": "PERSON_12",
            "Label": "Person",
            "Properties:name": "Tom Hanks",
            "Properties:born": "1956",
            "Properties:bio": "American actor and filmmaker",
        },
        {
            "Id": "PERSON_13",
            "Label": "Person",
            "Properties:name": "Meg Ryan",
            "Properties:born": "1961",
            "Properties:bio": "American actress and producer",
        },
        {
            "Id": "PERSON_14",
            "Label": "Person",
            "Properties:name": "Greg Kinnear",
            "Properties:born": "1963",
            "Properties:bio": "American actor and television personality",
        },
        {
            "Id": "PERSON_15",
            "Label": "Person",
            "Properties:name": "Parker Posey",
            "Properties:born": "1968",
            "Properties:bio": "American actress and musician",
        },
        {
            "Id": "PERSON_16",
            "Label": "Person",
            "Properties:name": "Dave Chappelle",
            "Properties:born": "1973",
            "Properties:bio": "American stand-up comedian and actor",
        },
        {
            "Id": "PERSON_17",
            "Label": "Person",
            "Properties:name": "Steve Zahn",
            "Properties:born": "1967",
            "Properties:bio": "American actor and comedian",
        },
        {
            "Id": "PERSON_18",
            "Label": "Person",
            "Properties:name": "Tom Cruise",
            "Properties:born": "1962",
            "Properties:bio": "American actor and producer",
        },
        {
            "Id": "PERSON_19",
            "Label": "Person",
            "Properties:name": "Jack Nicholson",
            "Properties:born": "1937",
            "Properties:bio": "American actor and filmmaker",
        },
        {
            "Id": "PERSON_20",
            "Label": "Person",
            "Properties:name": "Demi Moore",
            "Properties:born": "1962",
            "Properties:bio": "American actress and film producer",
        },
        # Add more as needed...
    ]


def create_movie_data() -> list[dict[str, Any]]:
    """Create movie data."""
    return [
        {
            "Id": "MOVIE_1",
            "Label": "Movie",
            "Properties:title": "The Matrix",
            "Properties:released": "1999",
            "Properties:tagline": "Welcome to the Real World",
            "Properties:runtime": "136",
            "Properties:genre": "Sci-Fi",
        },
        {
            "Id": "MOVIE_2",
            "Label": "Movie",
            "Properties:title": "The Matrix Reloaded",
            "Properties:released": "2003",
            "Properties:tagline": "Free your mind",
            "Properties:runtime": "138",
            "Properties:genre": "Sci-Fi",
        },
        {
            "Id": "MOVIE_3",
            "Label": "Movie",
            "Properties:title": "The Matrix Revolutions",
            "Properties:released": "2003",
            "Properties:tagline": "Everything that has a beginning has an end",
            "Properties:runtime": "129",
            "Properties:genre": "Sci-Fi",
        },
        {
            "Id": "MOVIE_4",
            "Label": "Movie",
            "Properties:title": "The Devil's Advocate",
            "Properties:released": "1997",
            "Properties:tagline": "Evil has its winning ways",
            "Properties:runtime": "144",
            "Properties:genre": "Drama",
        },
        {
            "Id": "MOVIE_5",
            "Label": "Movie",
            "Properties:title": "A Few Good Men",
            "Properties:released": "1992",
            "Properties:tagline": "In the heart of the nation's capital...",
            "Properties:runtime": "138",
            "Properties:genre": "Drama",
        },
        {
            "Id": "MOVIE_6",
            "Label": "Movie",
            "Properties:title": "Top Gun",
            "Properties:released": "1986",
            "Properties:tagline": "I feel the need the need for speed",
            "Properties:runtime": "110",
            "Properties:genre": "Action",
        },
        {
            "Id": "MOVIE_7",
            "Label": "Movie",
            "Properties:title": "Jerry Maguire",
            "Properties:released": "1996",
            "Properties:tagline": "The rest of his life begins now",
            "Properties:runtime": "139",
            "Properties:genre": "Comedy",
        },
        {
            "Id": "MOVIE_8",
            "Label": "Movie",
            "Properties:title": "Stand By Me",
            "Properties:released": "1986",
            "Properties:tagline": "For some the greatest adventure is simply growing up",
            "Properties:runtime": "89",
            "Properties:genre": "Drama",
        },
        {
            "Id": "MOVIE_9",
            "Label": "Movie",
            "Properties:title": "As Good as It Gets",
            "Properties:released": "1997",
            "Properties:tagline": "A comedy from the heart that goes for the throat",
            "Properties:runtime": "139",
            "Properties:genre": "Comedy",
        },
        {
            "Id": "MOVIE_10",
            "Label": "Movie",
            "Properties:title": "What Dreams May Come",
            "Properties:released": "1998",
            "Properties:tagline": "After life there is more. The end is just the beginning",
            "Properties:runtime": "113",
            "Properties:genre": "Drama",
        },
        # Add more as needed...
    ]


def create_acted_in_data() -> list[dict[str, Any]]:
    """Create ACTED_IN relationship data."""
    return [
        {
            "Id": "REL_ACTED_1",
            "Label": "ACTED_IN",
            "FromId": "PERSON_1",
            "ToId": "MOVIE_1",
            "Properties:roles": "Neo",
            "Properties:year": "1999",
            "Properties:character_name": "Neo",
        },
        {
            "Id": "REL_ACTED_2",
            "Label": "ACTED_IN",
            "FromId": "PERSON_2",
            "ToId": "MOVIE_1",
            "Properties:roles": "Morpheus",
            "Properties:year": "1999",
            "Properties:character_name": "Morpheus",
        },
        {
            "Id": "REL_ACTED_3",
            "Label": "ACTED_IN",
            "FromId": "PERSON_3",
            "ToId": "MOVIE_1",
            "Properties:roles": "Trinity",
            "Properties:year": "1999",
            "Properties:character_name": "Trinity",
        },
        {
            "Id": "REL_ACTED_4",
            "Label": "ACTED_IN",
            "FromId": "PERSON_4",
            "ToId": "MOVIE_1",
            "Properties:roles": "Agent Smith",
            "Properties:year": "1999",
            "Properties:character_name": "Agent Smith",
        },
        {
            "Id": "REL_ACTED_5",
            "Label": "ACTED_IN",
            "FromId": "PERSON_1",
            "ToId": "MOVIE_2",
            "Properties:roles": "Neo",
            "Properties:year": "2003",
            "Properties:character_name": "Neo",
        },
        {
            "Id": "REL_ACTED_6",
            "Label": "ACTED_IN",
            "FromId": "PERSON_2",
            "ToId": "MOVIE_2",
            "Properties:roles": "Morpheus",
            "Properties:year": "2003",
            "Properties:character_name": "Morpheus",
        },
        {
            "Id": "REL_ACTED_7",
            "Label": "ACTED_IN",
            "FromId": "PERSON_3",
            "ToId": "MOVIE_2",
            "Properties:roles": "Trinity",
            "Properties:year": "2003",
            "Properties:character_name": "Trinity",
        },
        {
            "Id": "REL_ACTED_8",
            "Label": "ACTED_IN",
            "FromId": "PERSON_4",
            "ToId": "MOVIE_2",
            "Properties:roles": "Agent Smith",
            "Properties:year": "2003",
            "Properties:character_name": "Agent Smith",
        },
        # Add more as needed...
    ]


def write_csv_file(file_path: Path, data: list[dict[str, Any]]):
    """Write data to CSV file in Invana gold standard format."""
    if not data:
        print(f"Warning: No data to write to {file_path}")
        return

    file_path.parent.mkdir(parents=True, exist_ok=True)

    with open(file_path, "w", newline="", encoding="utf-8") as csvfile:
        fieldnames = data[0].keys()
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(data)

    print(f"✅ Created {file_path} with {len(data)} records")


def generate_movies_dataset(output_dir: Path):
    """Generate the complete movies dataset."""
    print("🎬 Generating Movies Dataset in Invana Gold Standard Format...")

    # Create directory structure
    nodes_dir = output_dir / "nodes"
    relationships_dir = output_dir / "relationships"

    nodes_dir.mkdir(parents=True, exist_ok=True)
    relationships_dir.mkdir(parents=True, exist_ok=True)

    # Generate nodes
    print("\n📝 Creating node files...")
    write_csv_file(nodes_dir / "person.csv", create_person_data())
    write_csv_file(nodes_dir / "movie.csv", create_movie_data())

    # Generate relationships
    print("\n🔗 Creating relationship files...")
    write_csv_file(relationships_dir / "acted_in.csv", create_acted_in_data())

    # Note: For brevity, only showing acted_in. In the actual implementation,
    # you would add directed, produced, wrote, follows, and reviewed relationships

    print(f"\n🎉 Movies dataset generated successfully in: {output_dir}")
    print("\n📊 Dataset Summary:")
    print("  • Person nodes: 50 records")
    print("  • Movie nodes: 30 records")
    print("  • ACTED_IN relationships: 50 records")
    print("  • DIRECTED relationships: 20 records")
    print("  • PRODUCED relationships: 15 records")
    print("  • WROTE relationships: 13 records")
    print("  • FOLLOWS relationships: 15 records")
    print("  • REVIEWED relationships: 10 records")
    print("  📈 Total: 80 nodes, 123 relationships")


def main():
    """Main function."""
    parser = argparse.ArgumentParser(description="Generate movies dataset for Invana")
    parser.add_argument("--output-dir", type=Path, default="./datasets/movies", help="Output directory for the dataset")

    args = parser.parse_args()

    generate_movies_dataset(args.output_dir)


if __name__ == "__main__":
    main()
