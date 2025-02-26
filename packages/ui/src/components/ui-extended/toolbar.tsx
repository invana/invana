import React from 'react';
import { ButtonWithTooltip } from './button-with-tooltip';
import { Lock } from 'lucide-react';
import { Separator } from '../ui/separator';

const Toolbar: React.FC = () => {
  return (

    <div className="flex h-5 items-center space-x-2 text-sm">
      {/* <div> */}
      <ButtonWithTooltip
        variant="ghost"
        size="nav-icon"
        className="rounded-none hover:bg-gray-100 active:bg-gray:500"
        tooltip={<p>{"Unlock Canvas"}</p>}
      >
        <Lock className="h-4 w-4" />
      </ButtonWithTooltip>

      {/* </div> */}
      <Separator orientation="vertical" />
      <div>Docs</div>
      <Separator orientation="vertical" />
      <div>Source</div>
    </div>
  );
};

export { Toolbar };