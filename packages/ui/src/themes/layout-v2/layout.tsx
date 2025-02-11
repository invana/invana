"use client"
import { cn } from "../../lib/utils"
import {
  ResizablePanelGroup, ResizablePanel,
  ResizableHandle
} from "../../components/ui/resizable"
import { DefaultV2LayoutProps } from './types';
import { useDefaultV2LayoutStore } from "./store"
// import { PanelContent } from "./panel-content"
import { RightSidebar } from "./right-sidebar"
import React from "react"
import { AppHeader } from "../app";
import { TooltipProvider } from "../../components/ui";
import { LeftNav } from "./left-nav";


export const DefaultV2Layout: React.FC<DefaultV2LayoutProps> = ({
  className,
  headerProps,
  leftNavProps,
  leftContent,
  mainTopContent,
  mainBottomContent,
  rightContent }) => {

  const {
    leftContentName,
    rightContentSize,
    rightContentName,
    leftContentSize,
    // setLeftContentSize,
    mainTopContentSize,
    // setMainTopContentSize,
    // toggleLeftContent,
  } = useDefaultV2LayoutStore()

  return (
    <TooltipProvider delayDuration={0}>

      <div className={cn("flex h-screen flex-col bg-background text-foreground", className)}>
        <AppHeader
          left={headerProps?.left}
          center={headerProps?.center}
          right={headerProps?.right}
        />
        <div className="relative h-[calc(100vh-45px)] flex flex-1">
          <LeftNav className=" border-r" {...leftNavProps} />
          <main className="w-[calc(100vw-90px)]">
            {/* w-[calc(100vw-90px)] */}
            <div className="h-full">
              <ResizablePanelGroup
                autoSaveId="left-persistence"
                direction="horizontal"
                onLayout={(sizes) => {
                  console.debug("sizes", sizes)
                  // setLeftContentSize(sizes[0])
                }}
              >

                <ResizablePanel defaultSize={rightContentName ? (100 - rightContentSize) : 100}>
                  <ResizablePanelGroup
                    direction="vertical"
                    autoSaveId="main-persistence"
                    onLayout={(sizes) => {
                      console.debug("Vertical sizes", sizes)
                      // Update bottom panel size and collapse state
                      // setMainTopContentSize(sizes[0])
                    }}
                  >
                    <ResizablePanel minSize={30} defaultSize={mainTopContentSize} >
                      <div className="flex h-full items-center justify-center">
                        {/* <PanelContent title="Main Content" showClose={true}> */}
                        {mainTopContent}
                        {/* </PanelContent> */}
                      </div>
                    </ResizablePanel>
                    <ResizableHandle withHandle className={cn("transition-opacity duration-300")} />
                    <ResizablePanel minSize={3} defaultSize={100 - mainTopContentSize}>
                      <div className="flex-1 flex-col h-full">
                        {/* <div className="flex-1 overflow-auto"> */}
                        {/* <h1>Bottom here</h1> */}
                        {/* </div> */}
                        {mainBottomContent}

                      </div>
                    </ResizablePanel>
                  </ResizablePanelGroup>
                </ResizablePanel>

                <ResizableHandle
                  withHandle
                  className={cn("transition-opacity duration-300", !rightContentName && "hidden")}
                />
                <ResizablePanel
                  defaultSize={rightContentSize}
                  minSize={15}
                  maxSize={45}
                  style={{
                    display: rightContentName ? "block" : "none",
                  }}
                >
                  {/* <PanelContent title="Navigation Tree" onClose={() => toggleLeftContent('query')} showClose> */}
                  {rightContent}
                  {/* </PanelContent> */}
                </ResizablePanel>

              </ResizablePanelGroup>
            </div>
          </main>
          {/* {rightContentName && <RightSidebar>{rightContent}</RightSidebar>} */}
          <LeftNav className=" border-l" {...leftNavProps} />

        </div>
      </div>
    </TooltipProvider>
  )
}

