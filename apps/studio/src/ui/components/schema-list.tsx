// import { ICanvasData } from "@invana/data-store"
// import { cn } from "@invana/ui/lib/utils"
// import { Circle, Minus } from "lucide-react"


// export interface SchemaListViewProps {
//   children?: React.ReactNode
//   className?: string
//   schemaData: ICanvasData | undefined
// }

// export const SchemaListView = (props: SchemaListViewProps) => {

//   console.log("props.schemaData", props.schemaData)
//   return (
//     <div className={cn("w-full flex flex-col", props.className)}>
//       <div className="py-2 flex items-center justify-between pb-2 mt-5 border-b ">
//         <div className="flex items-center">
//           <h3 className="font-semibold text-xl  mb-1">Nodes</h3>
//         </div>
//         <div className="text-gray-500">0</div>
//       </div>
//       {props.schemaData?.nodes.map((node) => (
//         <div key={node.id} className="py-2 flex items-center justify-between">
//           <div className="flex items-center">
//             <Circle className="w-4 h-4 mr-2" /> {node.type}
//           </div>
//           <div className="text-gray-500">0</div>
//         </div>
//       ))}
//       <div></div>

//       <div className="py-2 flex items-center justify-between pb-2 mt-5 border-b ">
//         <div className="flex items-center">
//           <h3 className="font-semibold text-xl  mb-1">Relationships</h3>
//         </div>
//         <div className="text-gray-500">0</div>
//       </div>
//       {props.schemaData?.edges.map((edge) => (
//         <div key={edge.id} className="py-2 flex items-center justify-between">
//           <div className="flex items-center">
//             <Minus className="w-4 h-4 mr-2" /> {edge.type}
//           </div>
//           <div className="text-gray-500">0</div>
//         </div>
//       ))}
//     </div >
//   )
// }
