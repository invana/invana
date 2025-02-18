import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Separator,
  Tooltip, TooltipContent, TooltipTrigger
} from '@invana/ui';
import { Bell, Book, Share, Share2Icon } from 'lucide-react';
import React from 'react';
import CommandPalette from '../components/command/command-with-trigger';
import { ErrorBoundary } from '../components/error-boundary';


const AppHeaderRight: React.FC = () => {

  return (
    <>
      {/* <Tooltip>
        <TooltipTrigger asChild>
          <a href="https://github.com/invana/invana-studio" target="_blank" className="ml-2 mr-2">
            <img src="https://img.shields.io/github/stars/invana/invana-studio?style=social"
              alt="stars" className="  w-20 " />
          </a>
        </TooltipTrigger>
        <TooltipContent>Star or Fork this project</TooltipContent>
      </Tooltip> */}

      <ErrorBoundary>
        <CommandPalette />
      </ErrorBoundary>
      <Separator orientation="vertical" className="h-6 ml-3 mr-3" />


      {/* <Separator orientation="vertical" className="h-6 ml-2" /> */}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant={'ghost'} className="text-xs font-bold">
            <Share2Icon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Share this report</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant={'ghost'} size={'sm'} className="  ">
            <Book />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Learn </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant={'ghost'} size={'sm'} className=" ">
            <Bell />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Notification</TooltipContent>
      </Tooltip>
      {/* <Separator orientation="vertical" className="h-6 ml-3 " /> */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Avatar className="h-8 w-8 mr-2 ml-2">
            <AvatarImage src="/placeholder-user.jpg" alt="User" />
            <AvatarFallback className='bg-emerald-700 text-sm text-white font-bold'>RM</AvatarFallback>
          </Avatar>
        </TooltipTrigger>
        <TooltipContent>Anonymous User</TooltipContent>
      </Tooltip>
    </>
  );
};

export default AppHeaderRight;