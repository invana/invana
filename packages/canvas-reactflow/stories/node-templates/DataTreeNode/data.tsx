import { Folder, File, Database } from 'lucide-react'


export const data = {
  nodes: [{
    id: "2.1",
    type: "DataTreeNode",
    data: {
      headerTitle: "NSE Data (2.1)",
      headerDescription: "This comprehensive NSE dataset contains real-time market information.",
      icon: <Database className="h-4 w-4" />,
      searchable: true,
      children: [
        {
          label: "level-1.1",
          id: "level-1.1",
          icon: <File className="h-4 w-4 shrink-0 text-gray-500" />
        },
        {
          label: "level-1.2",
          id: "level-1.2",
          icon: <Folder className="h-4 w-4 shrink-0 text-yellow-500" />,
          isExpanded: true,
          children: [
            {
              label: "level-2.1",
              id: "level-2.1",
              icon: <File className="h-4 w-4 shrink-0 text-gray-500" />
            },
            {
              label: "level-2.2",
              id: "level-2.2",
              icon: <File className="h-4 w-4 shrink-0 text-gray-500" />
            },
            {
              label: "level-2.3",
              id: "level-2.3",
              icon: <File className="h-4 w-4 shrink-0 text-gray-500" />
            },
            {
              label: "level-2.4",
              id: "level-2.4",
              icon: <File className="h-4 w-4 shrink-0 text-gray-500" />
            },

            {
              label: "level-2.5",
              id: "level-2.5",
              icon: <Folder className="h-4 w-4 shrink-0 text-yellow-500" />,
              children: [
                {
                  label: "level-3.1",
                  id: "level-3.1",
                  icon: <File className="h-4 w-4 shrink-0 text-gray-500" />
                },
                {
                  label: "level-3.2",
                  id: "level-3.2",
                  icon: <File className="h-4 w-4 shrink-0 text-gray-500" />
                },
                {
                  label: "level-3.3",
                  id: "level-3.3",
                  icon: <File className="h-4 w-4 shrink-0 text-gray-500" />
                },
                {
                  label: "level-3.4",
                  id: "level-3.4",
                  icon: <File className="h-4 w-4 shrink-0 text-gray-500" />
                }
              ]
            }
          ]
        }
      ]
    },
    position: { x: -300, y: 0 }
  },
  {
    id: "2.2",
    type: "DataTreeNode",
    data: {
      headerTitle: "Source1 - Candle Data (2.2)",
      searchable: true,
      children: [
        {
          label: "level-3.1",
          id: "level-3.1",
          icon: <File className="h-4 w-4 shrink-0 text-gray-500" />
        },
        {
          label: "level-3.2",
          id: "level-3.2",
          icon: <File className="h-4 w-4 shrink-0 text-gray-500" />
        },
        {
          label: "level-3.3",
          id: "level-3.3",
          icon: <File className="h-4 w-4 shrink-0 text-gray-500" />
        },
        {
          label: "level-3.4",
          id: "level-3.4",
          icon: <File className="h-4 w-4 shrink-0 text-gray-500" />
        }
      ]
    },
    position: { x: 100, y: 0 }
  }],
  edges: []
}


