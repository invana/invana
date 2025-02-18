import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Separator,
  Tooltip, TooltipContent, TooltipTrigger
} from '@invana/ui';
import { Share } from 'lucide-react';
import React from 'react';


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
      <Separator orientation="vertical" className="h-6 ml-2" />


      {/* <Separator orientation="vertical" className="h-6 ml-2" /> */}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant={'outline'} size={'sm'} className="px-2 py-2 ">
            Share <Share strokeWidth={1} className='h-3 w-3' />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Logout</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Avatar className="h-8 w-8 mr-2">
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