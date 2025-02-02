"use client"
import { cn } from "../../lib/utils"
import { Button } from "../../components/ui/button"
import {
  ResizablePanelGroup, ResizablePanel,
  ResizableHandle
} from "../../components/ui/resizable"
import { DefaultNewLayoutProps } from './types';
import { usePanelStore } from "./store"
// import { PanelContent } from "./panel-content"
import { RightSidebar } from "./right-sidebar"
import React from "react"
import { AppHeader } from "../app";
import { TooltipProvider } from "../../components/ui";
import { LeftNav } from "./left-nav";


export const DefaultNewLayout: React.FC<DefaultNewLayoutProps> = ({
  className,
  headerProps,
  leftNavProps,
  leftContent,
  mainContent,
  rightContent }) => {

  const {
    leftContentName,
    rightContentName,
    bottomContentName,
    // toggleLeftContent,
    toggleBottomContent
  } = usePanelStore()

  return (
    <TooltipProvider delayDuration={0}>

      <div className={cn("flex h-screen flex-col bg-background text-foreground", className)}>
        <AppHeader
          left={headerProps?.left}
          center={headerProps?.center}
          right={headerProps?.right}
        />
        <div className="relative h-[calc(100vh-45px)] flex flex-1">
          <LeftNav {...leftNavProps} />
          <main className="flex-1  w-[calc(100vw-45px)]">
            <div className="h-full">
              <ResizablePanelGroup
                direction="horizontal"
                onLayout={(sizes) => {
                  console.debug("sizes", sizes)
                  // if (leftContentName) {
                  //   setLeftNavSize(sizes[0])
                  // }
                }}
              >
                <ResizablePanel
                  defaultSize={25}
                  minSize={15}
                  maxSize={40}
                  style={{
                    display: leftContentName ? "block" : "none",
                  }}
                >
                  {/* <PanelContent title="Navigation Tree" onClose={() => toggleLeftContent('query')} showClose> */}
                  {leftContent}
                  {/* </PanelContent> */}
                </ResizablePanel>
                <ResizableHandle
                  withHandle
                  className={cn("transition-opacity duration-300", !leftContentName && "hidden")}
                />
                <ResizablePanel defaultSize={leftContentName ? 75 : 100}>
                  <ResizablePanelGroup
                    direction="vertical"
                    onLayout={(sizes) => {
                      console.debug("sizes", sizes)
                      // Update bottom panel size and collapse state
                      // setBottomNavSize(sizes[1])
                      // // Update collapsed state based on size
                      // if (sizes[1] <= defaultBottomSize + 1) {
                      //   setBottomNavSize(defaultBottomSize)
                      // } else if (sizes[1] >= defaultBottomExpandedSize - 1) {
                      //   setBottomNavSize(defaultBottomExpandedSize)
                      // }
                    }}
                  >
                    <ResizablePanel minSize={30} defaultSize={97} >
                      {/* <div className="flex h-full items-center justify-center"> */}
                      {/* <PanelContent title="Main Content" showClose={true}> */}
                      {mainContent}
                      {/* </PanelContent> */}
                      {/* </div> */}
                    </ResizablePanel>
                    <ResizableHandle withHandle className={cn("transition-opacity duration-300")} />
                    <ResizablePanel minSize={3}>
                      <div className="flex flex-col h-full">
                        <div className="flex-1 overflow-auto">
                          {/* <h1>Bottom here</h1> */}
                          <Button size={"sm"} onClick={() => toggleBottomContent('query')}>Toggle Bottom {bottomContentName}</Button>
                        </div>

                      </div>
                    </ResizablePanel>
                  </ResizablePanelGroup>
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </main>
          {rightContentName && <RightSidebar>{rightContent}</RightSidebar>}
        </div>
      </div>
    </TooltipProvider>
  )
}

