


import { LANDING_ROUTE } from '@/constants';
import useConnections from '@/hooks/useConnection';
import { GraphDBConnection } from '@/models';
import {
  Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger, Input, Separator,
  Tooltip, TooltipContent, TooltipTrigger
} from '@invana/ui';
import { ChevronDown, Database, LogOut, Plus, Search } from 'lucide-react';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const AppHeaderRight: React.FC = () => {

  const { connections, setActiveConnectionId, getActiveConnection } = useConnections()

  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("")

  const filteredConnections: GraphDBConnection[] = connections.filter((connection) =>
    connection.name.toLowerCase().includes(searchQuery.toLowerCase())
  )


  const navigateToLanding = (connection: GraphDBConnection) => {
    setActiveConnectionId(connection.id)
    navigate(LANDING_ROUTE)
  }

  const logoutConnection = () => {
    setActiveConnectionId(undefined)
  }

  const activeConnection = getActiveConnection()


  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <a href="https://github.com/invana/invana-studio" target="_blank" className="ml-2 mr-2">
            <img src="https://img.shields.io/github/stars/invana/invana-studio?style=social"
              alt="stars" className="  w-20 " />
          </a>
        </TooltipTrigger>
        <TooltipContent>Star or Fork this project</TooltipContent>
      </Tooltip>
      <Separator orientation="vertical" className="h-6 ml-2" />

      {connections.length > 0 ?
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center space-x-2 ">
              <Database className=" h-4 " />
              <span >{activeConnection?.name || "select connection"}</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56  ">
            <DropdownMenuLabel>Switch connection</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search connections..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8"
                />
              </div>
            </div>
            <DropdownMenuSeparator />
            {filteredConnections.map((connection) => (
              <DropdownMenuItem
                key={connection.id}
                onClick={() => navigateToLanding(connection)}
                className="cursor-pointer"
              ><Database className=" h-4 " />
                {connection.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer">
              <Link to={"/connect?newConnection=true"} className="inline-flex">
                <Plus className="mr-2 h-4 w-4" />Add Connection
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={logoutConnection} >
              {/* <Button variant={"ghost"} className="px-2 py-2 "> */}
              <LogOut className="mr-2 h-4 w-4" />Logout
              {/* </Button> */}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        : <></>}
      {/* <Separator orientation="vertical" className="h-6 ml-2" /> */}

      {/* <Tooltip>
        <TooltipTrigger asChild>
          <Button variant={"ghost"} onClick={logoutConnection} className="px-2 py-2 ">
            <LogOut className=' h-4 ' />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Logout</TooltipContent>
      </Tooltip> */}
      {/* <Tooltip>
        <TooltipTrigger asChild>
          <Avatar className="h-8 w-8">
            <AvatarImage src="/placeholder-user.jpg" alt="User" />
            <AvatarFallback className='bg-emerald-700 text-white font-bold'>A</AvatarFallback>
          </Avatar>
        </TooltipTrigger>
        <TooltipContent>Anonymous User</TooltipContent>
      </Tooltip> */}
    </>
  );
};

export default AppHeaderRight;