import { DataTreeNodeProps } from "@invana/canvas-reactflow/templates/nodes/DataTreeNode";
import { Edge } from "@xyflow/react";
import { Database, File, Folder } from "lucide-react";
import React from "react";


export const data: { nodes: DataTreeNodeProps[], edges: Edge[] } = {
  nodes: [{
    id: "1",
    type: "DataTreeNode",
    position: { x: -300, y: 0 },
    data: {
      headerTitle: "SQL Database",
      headerDescription: "This node represents a SQL Database.",
      icon: <Database className="h-4 w-4" />,
      searchable: true,
      children: [
        {
          label: "Table 1",
          id: "table-1",
          icon: <File className="h-4 w-4 shrink-0  __text-gray-500" />
        },
        {
          label: "Table 2",
          id: "table-2",
          icon: <File className="h-4 w-4 shrink-0  __text-gray-500" />
        }
      ]
    },
  },
  {
    id: "2",
    type: "DataTreeNode",
    data: {
      headerTitle: "CSV Files",
      headerDescription: "This node represents a collection of CSV files.",
      icon: <Folder className="h-4 w-4" />,
      searchable: true,
      children: [
        {
          label: "File 1",
          id: "file-1",
          icon: <File className="h-4 w-4 shrink-0  __text-gray-500" />
        },
        {
          label: "File 2",
          id: "file-2",
          icon: <File className="h-4 w-4 shrink-0  __text-gray-500" />
        }
      ]
    },
    position: { x: 100, y: 0 }
  }
    ,
  {
    id: "3",
    type: "DataTreeNode",
    data: {
      headerTitle: "Table 1",
      headerDescription: "This node represents Table 1.",
      icon: <File className="h-4 w-4" />,
      searchable: true,
      children: [
        {
          label: "Columns",
          id: "columns-1",
          icon: <File className="h-4 w-4 shrink-0  __text-gray-500" />,
          children: [
            { label: "Column 1", id: "column-1-1", icon: <File className="h-4 w-4 shrink-0  __text-gray-500" /> },
            { label: "Column 2", id: "column-1-2", icon: <File className="h-4 w-4 shrink-0  __text-gray-500" /> }
          ]
        },
        {
          label: "Extra_info",
          id: 'extra_info-1',
          icon: <File className="h-4 w-4 shrink-0  __text-gray-500" />,

          children: [
            {
              label: "Indexes",
              id: "indexes-1",
              icon: <File className="h-4 w-4 shrink-0  __text-gray-500" />,
              children: [
                { label: "Index 1", id: "index-1-1", icon: <File className="h-4 w-4 shrink-0  __text-gray-500" /> },
                { label: "Index 2", id: "index-1-2", icon: <File className="h-4 w-4 shrink-0  __text-gray-500" /> }
              ]
            },
            {
              label: "Views",
              id: "views-1",
              icon: <File className="h-4 w-4 shrink-0  __text-gray-500" />,
              children: [
                { label: "View 1", id: "view-1-1", icon: <File className="h-4 w-4 shrink-0  __text-gray-500" /> },
                { label: "View 2", id: "view-1-2", icon: <File className="h-4 w-4 shrink-0  __text-gray-500" /> }
              ]
            }
          ]
        }

      ]
    },
    position: { x: -100, y: 200 }
  },
  {
    id: "4",
    type: "DataTreeNode",
    data: {
      headerTitle: "Table 2",
      headerDescription: "This node represents Table 2.",
      icon: <File className="h-4 w-4" />,
      searchable: true,
      children: [
        {
          label: "Columns",
          id: "columns-2",
          icon: <File className="h-4 w-4 shrink-0  __text-gray-500" />,
          children: [
            { label: "Column 1", id: "column-2-1", icon: <File className="h-4 w-4 shrink-0  __text-gray-500" /> },
            { label: "Column 2", id: "column-2-2", icon: <File className="h-4 w-4 shrink-0  __text-gray-500" /> }
          ]
        },
        {
          label: "Extra_info",
          id: 'extra_info-2',
          icon: <File className="h-4 w-4 shrink-0  __text-gray-500" />,
          children: [
            {
              label: "Indexes",
              id: "indexes-2",
              icon: <File className="h-4 w-4 shrink-0  __text-gray-500" />,
              children: [
                { label: "Index 1", id: "index-2-1", icon: <File className="h-4 w-4 shrink-0  __text-gray-500" /> },
                { label: "Index 2", id: "index-2-2", icon: <File className="h-4 w-4 shrink-0  __text-gray-500" /> }
              ]
            },
            {
              label: "Views",
              id: "views-2",
              icon: <File className="h-4 w-4 shrink-0  __text-gray-500" />,
              children: [
                { label: "View 1", id: "view-2-1", icon: <File className="h-4 w-4 shrink-0  __text-gray-500" /> },
                { label: "View 2", id: "view-2-2", icon: <File className="h-4 w-4 shrink-0  __text-gray-500" /> }
              ]
            }
          ]

        }

      ]
    },
    position: { x: 300, y: 200 }
  },
  {
    id: "5",
    type: "DataTreeNode",
    data: {
      headerTitle: "Reports",
      headerDescription: "These are the report based both tables.",
      icon: <File className="h-4 w-4" />,
      searchable: true,
      children: [
        {
          id: "report-1",
          label: "Report 1",
          icon: <File className="h-4 w-4 shrink-0  __text-gray-500" />,
          children: [
            { label: "Column 1", id: "column-5-1", icon: <File className="h-4 w-4 shrink-0  __text-gray-500" /> },
            { label: "Column 2", id: "column-5-2", icon: <File className="h-4 w-4 shrink-0  __text-gray-500" /> }
          ]
        },
      ]


    },
    position: { x: 500, y: 200 }

  }
  ],
  edges: [
    {
      id: "2-file-1",
      source: "2",
      sourceHandle: "file-1",
      target: "1",
      targetHandle: "table-1"
    },
    {
      id: "2-file-2",
      source: "2",
      sourceHandle: "file-2",
      target: "1",
      targetHandle: "table-2"
    },
    {
      id: "table-1-3",
      source: "1",
      sourceHandle: "table-1",
      target: "3",
    },
    {
      id: "table-2-4",
      source: "1",
      sourceHandle: "table-2",
      target: "4",
    },

    {
      id: "3-column-5-1",
      source: "3",
      sourceHandle: "index-1-1",
      target: "5",
      targetHandle: "column-5-1"
    },
    {
      id: "5-column-5-1",
      source: "4",
      sourceHandle: "view-2-1",
      target: "5",
      targetHandle: "column-5-2"
    }

  ],
  viewport: {
    x: 413.7305422421646,
    y: 210.08971667578632,
    zoom: 0.8133791981321252
  }
}
