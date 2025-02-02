import {
  Card, CardHeader, CardTitle, Select, SelectTrigger,
  SelectValue, SelectContent, SelectItem, Button, CardContent,
  CardFooter
} from "@invana/ui"
import { Play } from "lucide-react"
import Editor, { OnMount } from '@monaco-editor/react'
import { useRef, useState } from "react"
import { cn } from "@invana/ui/lib/utils"


type QueryLanguage = 'gremlin' | 'cypher'

export interface QueryFormProps {
  children?: React.ReactNode
  className?: string
}

export const QueryForm = (props: QueryFormProps) => {

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
    },
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

  //@ts-ignore
  const editorRef = useRef<any | null>(null);

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;
    editor.focus();
    const model = editor.getModel();
    if (model) {
      const lineCount = model.getLineCount();
      const lastLineLength = model.getLineLength(lineCount);
      editor.setPosition({ lineNumber: lineCount, column: lastLineLength + 1 });
    }
  };

  return (
    <div className={cn("h-full w-full flex flex-col", props.className)}>
      <Card className="flex-1 flex flex-col  rounded-none p-0">
        {/* <CardHeader className="flex flex-row border-b items-center p2 justify-between space-y-0">
          <CardTitle className="font-bold uppercase  ">Query Console</CardTitle>
        </CardHeader> */}
        <CardContent className="p-0">

          {/* <div className="flex-1 overflow-hidden border-b bg-background "> */}
          <Editor
            height={'calc(100vh - 450px)'}
            defaultLanguage="sql"
            language="sql"
            theme="vs-dark"
            value={query}
            onMount={handleEditorDidMount}
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
            beforeMount={(_) => {
              return () => {
                if (editorRef.current) {
                  editorRef.current.dispose();
                  editorRef.current = null;
                }
              };
            }}
          />
          {/* </div> */}
        </CardContent>
        <CardFooter className=" flex items-center justify-between "  >
          {/* <div > */}
          <Select value={language} onValueChange={(value) => handleLanguageChange(value as QueryLanguage)}>
            <SelectTrigger className="w-[180px] px-2   border-sm py-1">
              <SelectValue placeholder="Select language" />
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
          {/* </div> */}
        </CardFooter>
      </Card>
      <Card className=" flex flex-col rounded-none">
        <CardHeader>
          <CardTitle>
            last query
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-4 p-0 h-[350px] overflow-y-auto p-2 border-0 !border-t">
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
        </CardContent>
      </Card>

    </div >
  )
}
