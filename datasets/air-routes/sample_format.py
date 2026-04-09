"""
Sample output showing what the generated CSV files will look like
after running the generator script.

This demonstrates the gold standard CSV format for air-routes data.
"""

# Example: datasets/air-routes/nodes/airport.csv
AIRPORT_CSV_SAMPLE = """Id,Label,Properties:code,Properties:icao,Properties:iata,Properties:city,Properties:desc,Properties:region,Properties:runways,Properties:longest,Properties:elev,Properties:country,Properties:lat,Properties:lon
1,airport,ANC,PANC,ANC,Anchorage,Anchorage Ted Stevens,US-AK,3,12400,151,US,61.17432,-149.996307
2,airport,LAX,KLAX,LAX,Los Angeles,Los Angeles International,US-CA,4,12923,125,US,33.942536,-118.408074
3,airport,DFW,KDFW,DFW,Dallas,Dallas Fort Worth International,US-TX,7,13401,607,US,32.896828,-97.037997
4,airport,JFK,KJFK,JFK,New York,John F Kennedy Intl,US-NY,4,14511,13,US,40.639751,-73.778925
5,airport,ORD,KORD,ORD,Chicago,Chicago O'Hare International,US-IL,8,13000,672,US,41.974162,-87.907321"""

# Example: datasets/air-routes/nodes/country.csv
COUNTRY_CSV_SAMPLE = """Id,Label,Properties:code,Properties:desc
237,country,US,United States
238,country,CA,Canada
239,country,MX,Mexico
240,country,GB,United Kingdom
241,country,FR,France"""

# Example: datasets/air-routes/nodes/continent.csv
CONTINENT_CSV_SAMPLE = """Id,Label,Properties:code,Properties:desc
3951,continent,NA,North America
3952,continent,SA,South America
3953,continent,EU,Europe
3954,continent,AS,Asia
3955,continent,AF,Africa
3956,continent,AU,Australia
3957,continent,AN,Antarctica"""

# Example: datasets/air-routes/edges/route.csv
ROUTE_CSV_SAMPLE = """Id,Label,FromId,ToId,Properties:dist
6954,route,1,2,2345
6955,route,1,3,3038
6956,route,2,3,1235
6957,route,2,4,2445
6958,route,3,5,925"""

# Example: datasets/air-routes/edges/contains.csv
CONTAINS_CSV_SAMPLE = """Id,Label,FromId,ToId
7324,contains,237,3951
7325,contains,238,3951
7326,contains,239,3951
7327,contains,1,237
7328,contains,2,237
7329,contains,3,237
7330,contains,4,237
7331,contains,5,237"""

if __name__ == "__main__":
    print("Air Routes Dataset - Sample CSV Formats")
    print("=" * 60)

    print("\n📄 AIRPORT NODES (airport.csv)")
    print("-" * 40)
    lines = AIRPORT_CSV_SAMPLE.strip().split("\n")
    for line in lines[:3]:  # Show header + 2 rows
        print(line)
    print(f"... ({len(lines)-3} more rows)")

    print("\n🌍 COUNTRY NODES (country.csv)")
    print("-" * 40)
    lines = COUNTRY_CSV_SAMPLE.strip().split("\n")
    for line in lines:
        print(line)

    print("\n🌎 CONTINENT NODES (continent.csv)")
    print("-" * 40)
    lines = CONTINENT_CSV_SAMPLE.strip().split("\n")
    for line in lines:
        print(line)

    print("\n✈️  ROUTE EDGES (route.csv)")
    print("-" * 40)
    lines = ROUTE_CSV_SAMPLE.strip().split("\n")
    for line in lines:
        print(line)

    print("\n📦 CONTAINS EDGES (contains.csv)")
    print("-" * 40)
    lines = CONTAINS_CSV_SAMPLE.strip().split("\n")
    for line in lines:
        print(line)

    print("\n" + "=" * 60)
    print("✅ This shows the Invana Gold Standard CSV format")
    print("✅ Each node/edge type in separate files")
    print("✅ Properties prefixed with 'Properties:'")
    print("✅ Ready for Invana CSV Loader")
