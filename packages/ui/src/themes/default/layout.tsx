import "@/styles/globals.css"
import { PanelProvider } from "./context/panel-context"


export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <PanelProvider initialSize={20} > {children} </PanelProvider>
  )
}

