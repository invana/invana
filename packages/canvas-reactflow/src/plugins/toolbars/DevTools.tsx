import React, {
  useState,
} from 'react';
import {
  Panel,
} from '@xyflow/react';
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@invana/ui/components/ui/toggle-group"
import { ChangeLogger } from "../options/DevTools/ChangeLogger"
import { ViewportLogger } from '../options/DevTools/ViewportLogger';
import { NodeInspector } from '../options/DevTools/NodeInspector';
import { CanvasPanelProps } from '../types';


export const DevTools: React.FC<CanvasPanelProps> = (props) => {
  const [nodeInspectorActive, setNodeInspectorActive] = useState(false);
  const [changeLoggerActive, setChangeLoggerActive] = useState(false);
  const [viewportLoggerActive, setViewportLoggerActive] = useState(false);

  const tools = [
    { active: nodeInspectorActive, setActive: setNodeInspectorActive, label: 'Node Inspector', value: 'node-inspector' },
    { active: changeLoggerActive, setActive: setChangeLoggerActive, label: 'Change Logger', value: 'change-logger' },
    { active: viewportLoggerActive, setActive: setViewportLoggerActive, label: 'Viewport Logger', value: 'viewport-logger' },
  ];

  return (
    <div>
      <Panel {...props}>
        <ToggleGroup type="multiple" className='h-6'>
          {tools.map(({ active, setActive, label, value }) => (
            <ToggleGroupItem
              key={value}
              value={value}
              onClick={() => setActive((prev) => !prev)}
              aria-pressed={active}
              className=" text-card-foreground transition-colors rounded-none duration-300 hover:bg-secondary hover:text-secondary-foreground !h-6
              "
            >
              {label}
              {/* {index < tools.length - 1 && <Separator orientation='vertical' />} */}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Panel>

      {changeLoggerActive && (
        <Panel className="text-xs p-3 bg-white border shadow-md overflow-y-auto w-[320px] max-h-[50%] mt-20" position="bottom-right" style={{ bottom: '50px', }}>
          <ChangeLogger />
        </Panel>
      )}

      {nodeInspectorActive && <NodeInspector />}

      {viewportLoggerActive && (
        <Panel position="bottom-right" className="text-secondary-foreground" style={{ bottom: '30px', }}>
          <ViewportLogger />
        </Panel>
      )}
    </div>
  );
}

DevTools.displayName = "DevTools";
