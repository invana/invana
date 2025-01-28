import {
  Card, CardHeader, CardTitle, Select, SelectTrigger,
  SelectValue, SelectContent, SelectItem, Button, CardContent
} from "@invana/ui"
import { Play } from "lucide-react"
import Editor from '@monaco-editor/react'
import { useState } from "react"


type QueryLanguage = 'gremlin' | 'cypher'


export const QueryForm = (props) => {

  const [language, setLanguage] = useState<QueryLanguage>('gremlin')

  const queryString = `-- Write your ${language} query here
g.V()
.limit(10)
.elementMap()
.toList()
`
  const queryHistory = [
    {
      query: queryString,
      createdAt: new Date()
    }
  ]

  const [query, setQuery] = useState(queryString)

  const handleExecuteQuery = () => {
    console.log('Executing query:', query)
    // Here you would typically send the query to your backend
  }

  const handleLanguageChange = (newLanguage: QueryLanguage) => {
    setLanguage(newLanguage)
  }

  return (
    <div className="h-full flex flex-col">
      <Card className="flex-1 flex flex-col border-0 rounded-none">
        <CardHeader className="flex flex-row border-b items-center justify-between space-y-0">
          <CardTitle className="font-bold uppercase">Query Console</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-4 p-0">

          <div className="flex-1 overflow-hidden bg-background">
            <Editor
              height="100%"
              defaultLanguage="sql"
              language="sql"
              theme="vs-dark"
              value={query}
              onChange={(value) => setQuery(value || "")}
              options={{
                minimap: { enabled: false },
                lineNumbers: "on",
                lineHeight: 24,
                padding: { top: 13, bottom: 13 },
                scrollBeyondLastLine: false,
                fontSize: 13,
                tabSize: 2,
                wordWrap: "on",
                automaticLayout: true,
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-4 px-3 pt-0 pb-0">
            <Select value={language} onValueChange={(value) => handleLanguageChange(value as QueryLanguage)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select language" defaultValue={"gremlin"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gremlin">gremlin</SelectItem>
                <SelectItem value="cypher">cypher</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleExecuteQuery} className="gap-2">
              <Play className="w-4 h-4" />
              Execute Query
            </Button>
          </div>
          <div className="h-90 overflow-auto p-2 border-0 !border-t bg-muted/40">
            <h3 className="font-semibold mb-2">Query history</h3>

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
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
