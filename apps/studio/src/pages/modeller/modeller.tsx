import { Network } from 'lucide-react';
import React from 'react';
import { CanvasFlow, CanvasToolBar, defaultFlowCanvasOptions } from '@invana/canvas-reactflow';
import { LogoComponent, bottomNavItems, topNavItems } from '../constants';
import { ProductCopyRightInfo, ProductName } from '@/constants';
import {
  BlankLayout
} from '@invana/ui';
import { ReactFlowProvider } from '@invana/canvas-reactflow';
import { data } from '../explorer/dummy-data'
import { AppHeader, AppFooter, AppMain } from '@invana/ui/themes/app'
import useTheme from '@invana/ui/hooks/useTheme';
import AppHeaderRight from '@/ui/header/app-header-right';


const ModellerPage: React.FC = () => {

  const { theme } = useTheme()

  return (
    <BlankLayout
      logo={LogoComponent}
      bottomNavItems={bottomNavItems}
      topNavItems={topNavItems}
    >

      <ReactFlowProvider fitView>
        <AppHeader
          left={
            <>
              {/* <Network className='h-4 w-4' /> */}
              <span className='font-bold mr-2'>{ProductName}</span>
              <span className='mr-2'>|</span>
              <span>Modeller</span>
            </>
          }
          center={
            <CanvasToolBar />
          }
          right={
            <AppHeaderRight />
          }
        >

        </AppHeader>

        <AppMain>
          <CanvasFlow nodes={data.nodes} edges={data.edges}
            style={{ width: '100%', height: '100%' }}
            canvas={{ ...defaultFlowCanvasOptions.canvas, colorMode: theme }}
            display={{
              plugins: {
                devTools: false,
                miniMap: true,
                controls: false,
                background: true,
                theme: true
              }
            }}
          />
        </AppMain>

        <AppFooter
          right={ProductCopyRightInfo}
        >

        </AppFooter>
      </ReactFlowProvider>
    </BlankLayout >
  );
};

export default ModellerPage;