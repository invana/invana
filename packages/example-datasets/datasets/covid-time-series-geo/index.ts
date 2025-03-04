import { ICanvasData } from "@invana/data-store"
import csv_data from "./covid-timeseries-geo-data-confirmed.json";




const createData = (): ICanvasData => {

  const nodes = new Map();
  const edges = new Map();


  nodes.set("COVIDCases", {
    id: "COVIDCases",
    type: 'COVIDCases',
    properties: {
      name: "COVIDCases",
    }
  });


  csv_data.flatMap((row: any) => {
    const dateKeys = Object.keys(row).filter((key) =>
      key !== "Country/Region" &&
      key !== "Province/State" &&
      key !== "Lat" &&
      key !== "Long"
    );
    dateKeys.slice(0, 1).map((dateKey: any) => {
      const nodeKey = `${row["Province/State"] ? `${row["Province/State"]}-${row["Country/Region"]}-${dateKey}` : row["Country/Region"]}-${dateKey}`;
      const dateObj = new Date(dateKey.split('/').map((n: string, i: number) => i === 2 ? '20' + n : n).join('/'));

      nodes.set(nodeKey, {
        id: nodeKey,
        type: 'COVIDConfirmedCase',
        properties: {
          name: row["Province/State"] ? `${row["Province/State"]},${row["Country/Region"]}` : row["Country/Region"],
          country: row["Country/Region"],
          province_or_state: row["Province/State"],
          cases_confirmed: row[dateKey],
          timestamp: dateObj,
          lat: row["Lat"],
          long: row["Long"]
        }
      });
    })
    const countryKey = `${row["Country/Region"]}`;
    nodes.set(countryKey, {
      id: `${row["Country/Region"]}`,
      type: 'Country',
      properties: {
        country: row["Country/Region"],
        lat: row["Lat"],
        long: row["Long"]
      }
    })
  })


  csv_data.map((row: any) => {
    const dateKeys = Object.keys(row).filter((key) =>
      key !== "Country/Region" &&
      key !== "Province/State" &&
      key !== "Lat" &&
      key !== "Long"
    );
    dateKeys.slice(0, 1).map((dateKey: any) => {
      const from_key = `${row["Province/State"] ? `${row["Province/State"]}-${row["Country/Region"]}-${dateKey}` : row["Country/Region"]}-${dateKey}`;
      const dateObj = new Date(dateKey.split('/').map((n: string, i: number) => i === 2 ? '20' + n : n).join('/'));

      edges.set(`${from_key}-${row["Country/Region"]}`, {
        id: `${from_key}-${row["Country/Region"]}`,
        type: 'is_related_to',
        target: from_key,
        source: `${row["Country/Region"]}`,
        properties: {
          cases_confirmed: row[dateKey],
          timestamp: dateObj,
        }
      });
    })

    edges.set(`COVIDCases-${row["Country/Region"]}`, {
      id: `COVIDCases-${row["Country/Region"]}`,
      type: 'is_related_to',
      source: 'COVIDCases',
      target: `${row["Country/Region"]}`,
      properties: {}
    });
  })

  const data: ICanvasData = {
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values()),
  }

  return data
}


export const COVIDTimeSeriesGeoDataSet: ICanvasData = createData()