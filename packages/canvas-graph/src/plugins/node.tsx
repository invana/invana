import React, { useState } from 'react';
import {
  Card, CardContent, CardDescription, CardHeader,
  CardTitle, MenuItem, NestedMenu
} from '@invana/ui';
import { Graph, IElementEvent, NodeData, NodeEvent } from '@antv/g6';
import { ICanvasNode } from '@invana/data-store';
import { ContextMenuBase } from './abstract';
import { File, FolderOpen, Bell, Shield, Mail, Settings, Users } from 'lucide-react'
import { NodeCard } from '../components/node-card';


interface NodeContextMenuProps {
  getGraph: () => Graph;
  className?: string;
}

export const menuItems: MenuItem[] = [
  {
    id: 'files',
    label: 'Incoming',
    icon: FolderOpen,
    shortcut: '⌘F',
    children: [
      {
        id: 'shared',
        label: 'Shared Files',
        icon: FolderOpen,
        shortcut: '⌘S',
      },
      {
        id: 'recent',
        label: 'Recent Files',
        icon: File,
        shortcut: '⌘R',
      }
    ]
  },
  {
    id: 'settings',
    label: 'OutGoing',
    icon: Settings,
    shortcut: '⌘,',
    children: [
      {
        id: 'account',
        label: 'Account Settings',
        icon: Users,
        children: [
          {
            id: 'profile',
            label: 'Profile',
            icon: Users,
            shortcut: '⌘P'
          },
          {
            id: 'security',
            label: 'Security',
            icon: Shield,
            shortcut: '⌘L'
          }
        ]
      },
      {
        id: 'notifications',
        label: 'Notifications',
        icon: Bell,
        shortcut: '⌘N'
      }
    ]
  },
  {
    id: 'messages',
    label: 'graph algorithms',
    icon: Mail,
    shortcut: '⌘M',
    children: [
      {
        id: 'shared',
        label: 'Shared Files',
        icon: FolderOpen,
        shortcut: '⌘S',
      },
      {
        id: 'recent',
        label: 'Recent Files',
        icon: File,
        shortcut: '⌘R',
      }
    ]
  }
]

export type ContextMenuData = ContextMenuBase<(NodeData & { data?: ICanvasNode })>

export const NodeContextMenu: React.FC<NodeContextMenuProps> = ({ getGraph, className }) => {
  console.log("NodeContextMenu -> getGraph", getGraph, className)
  const graph = getGraph();
  const [contextMenuData, setContextMenuData] = useState<ContextMenuData>({
    visible: false, x: 0, y: 0, data: null,
  });

  const handleNodeContextMenu = (e: IElementEvent) => {
    e.preventDefault();
    e.originalEvent.stopPropagation()
    e.originalEvent.preventDefault()
    const node = graph.getNodeData(e.target.id) as (NodeData & { data?: ICanvasNode });
    const { client } = e;
    setContextMenuData({
      visible: true,
      x: client.x,
      y: client.y,
      data: node,
    });
  };

  const closeContextMenu = () => {
    setContextMenuData({
      ...contextMenuData,
      visible: false,
    });
  };

  graph.on(NodeEvent.CONTEXT_MENU, handleNodeContextMenu);

  React.useEffect(() => {
    graph.on(NodeEvent.CONTEXT_MENU, handleNodeContextMenu);
    return () => {
      graph.off(NodeEvent.CONTEXT_MENU, handleNodeContextMenu);
    };
  }, [graph]);

  // console.log("=====contextMenuData", contextMenuData)
  return (
    <>
      {contextMenuData.visible && contextMenuData.data && (
        <div
          style={{
            position: 'absolute',
            top: contextMenuData.y,
            left: contextMenuData.x,
            zIndex: 10000,
            pointerEvents: 'auto',
          }}
          onMouseLeave={closeContextMenu}
        >
          <NodeCard
            node={contextMenuData.data}
            extra={
              <NestedMenu
                className='rounded-none w-[260px] shadow-none p-0 border-none'
                menuItems={menuItems}
              />
            }
          />
        </div>
      )}
    </>
  );
};

