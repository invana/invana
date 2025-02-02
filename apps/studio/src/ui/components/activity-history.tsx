import { cn } from "@invana/ui/lib/utils"


export interface ActivityHistoryProps {
  children?: React.ReactNode
  className?: string
}

export const ActivityHistoryView = (props: ActivityHistoryProps) => {

  const queryString = `-- Write your gremlin query here
g.V()
.limit(10)
.elementMap()
.toList()
`
  const queryHistory = Array(20).fill({
    query: queryString,
    createdAt: new Date()
  })


  return (
    <div className={cn("w-full flex flex-col", props.className)}>

      {
        queryHistory.map((item, index) => (
          <div key={index} className="mb-2 p-2 border rounded-md">
            <pre className="text-sm">{item.query}</pre>
            <span className="text-xs text-muted-foreground">
              {item.createdAt.toLocaleString()}
            </span>
          </div>
        ))
      }
      {/* <p className="text-muted-foreground">Execute a query to see results here.</p> */}


    </div >
  )
}
