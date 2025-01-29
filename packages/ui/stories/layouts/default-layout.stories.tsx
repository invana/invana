import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@invana/ui';
import { DefaultLayout } from '@/themes/default/default';
import type { Meta, StoryObj } from '@storybook/react';
import { usePanel } from '@/themes/default/context/panel-context';
import { cn } from '@/lib/utils';
import React from 'react';
// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'Layouts/DefaultLayout',
  component: DefaultLayout,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    children: <div>Main Content here</div>,
  },
} satisfies Meta<typeof DefaultLayout>;

export default meta;
type Story = StoryObj<typeof meta>;





const MainContent: React.FC = () => {
  const { setNavSize, sidebar } = usePanel()
  const isNavTreeVisible = sidebar === "query"

  return <div className="h-[calc(100vh-50px)]">
    <ResizablePanelGroup
      direction="horizontal"
      onLayout={(sizes) => {
        if (isNavTreeVisible) {
          setNavSize(sizes[0])
        }
      }}
    >
      <ResizablePanel
        defaultSize={25}
        minSize={15}
        maxSize={40}
        style={{
          display: isNavTreeVisible ? "block" : "none",
        }}
      >
        <div className='flex h-full flex-col'>
          <div
            className={cn(
              "space-y-2 min-w-[300px]",
              !isNavTreeVisible && "opacity-0",
              "transition-opacity duration-200",
            )}
          >
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="rounded border bg-card p-2 text-sm">
                Item {i + 1}
              </div>
            ))}
          </div>
        </div>
      </ResizablePanel>
      <ResizableHandle
        withHandle
        className={cn("transition-opacity duration-300", !isNavTreeVisible && "hidden")}
      />
      <ResizablePanel defaultSize={isNavTreeVisible ? 75 : 100}>
        <ResizablePanelGroup direction="vertical">
          <ResizablePanel defaultSize={60}>
            <div className='flex h-full flex-col'>
              <div className="prose dark:prose-invert">
                <h3>Welcome to the Dashboard</h3>
                <p>
                  This is a resizable panel layout. You can drag the handles between panels to resize them. The
                  layout is persistent and will maintain its state across reloads.
                </p>
                <p>Try dragging the handles between panels to resize them:</p>
                <ul>
                  <li>Click the home icon to toggle the navigation tree</li>
                  <li>The navigation tree panel has a minimum width of 300px and is resizable</li>
                  <li>Drag the vertical handle to resize the content sections</li>
                </ul>
              </div>
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={40}>
            <div className='flex h-full flex-col'>
              <div className="space-y-4">
                <div className="rounded-lg border bg-card p-4">
                  <h4 className="text-sm font-medium">Statistics</h4>
                  <div className="mt-2 grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xl font-bold">2,345</p>
                      <p className="text-xs text-muted-foreground">Total Views</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xl font-bold">1,234</p>
                      <p className="text-xs text-muted-foreground">Unique Visitors</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <h4 className="text-sm font-medium">Recent Activity</h4>
                  <div className="mt-2 space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                        <span>Activity {i + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>

}

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Default: Story = {
  args: {
    children: <MainContent />
  },
};