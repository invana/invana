"use client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { Bell, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DefaultNewLayoutProps } from './types';
import { LeftNav } from "./leftNav"
import { Header } from "./header"
import { usePanelStore } from "./store"
import { PanelContent } from "./panel-content"
import { RightSidebar } from "./right-sidebar"
import React from "react"


export function DefaultNewLayout({ className, leftNavProps, leftContent, mainContent, rightContent }: DefaultNewLayoutProps) {
  const {
    leftContentName,
    rightContentName,
    bottomContentName,
    toggleLeftContent,
    toggleBottomContent
  } = usePanelStore()

  return (
    <div className={cn("flex h-screen flex-col bg-background text-foreground", className)}>
      <Header
        left={<span className="font-semibold">Dashboard</span>}
        center={
          <div className="hidden md:flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder="Search..." className="h-8 w-[200px] lg:w-[300px]" />
          </div>
        }
        right={
          <>
            <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src="/placeholder.svg" alt="User" />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            </Button>
          </>
        }
      />
      <div className="relative h-[calc(100vh-50px)] flex flex-1">
        <LeftNav {...leftNavProps} />
        <main className="flex-1">
          <div className="h-full">
            <ResizablePanelGroup
              direction="horizontal"
              onLayout={(sizes) => {
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
                <PanelContent title="Navigation Tree" onClose={() => toggleLeftContent('query')} showClose>
                  {leftContent}
                </PanelContent>
              </ResizablePanel>
              <ResizableHandle
                withHandle
                className={cn("transition-opacity duration-300", !leftContentName && "hidden")}
              />
              <ResizablePanel defaultSize={leftContentName ? 75 : 100}>
                <ResizablePanelGroup
                  direction="vertical"
                  onLayout={(sizes) => {
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
                  <ResizablePanel minSize={30} >
                    <div className="flex h-full items-center justify-center">

                      {mainContent}
                    </div>
                  </ResizablePanel>
                  <ResizableHandle withHandle className={cn("transition-opacity duration-300")} />
                  <ResizablePanel minSize={2}>
                    <div className="flex flex-col h-full">
                      <div className="flex-1 overflow-auto">
                        <h1>Bottom here</h1>
                        <Button onClick={() => toggleBottomContent('query')}>Toggle Bottom {bottomContentName}</Button>
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
  )
}

