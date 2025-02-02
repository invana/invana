import React from 'react';
import { BlankLayout, BlankLayoutProps, useThemeStore } from '@invana/ui';


export interface MainLayoutProps extends BlankLayoutProps {
  header: React.ReactNode,
  footer: React.ReactNode,
  children: React.ReactNode
}

export const MainLayout: React.FC<MainLayoutProps> = (props) => {
  const { initTheme } = useThemeStore();
  initTheme()
  return (
    <BlankLayout
      logo={props.logo}
      topNavItems={props.topNavItems}
      bottomNavItems={props.bottomNavItems}
    >
      <header className="flex h-[50px] items-center border-b border-border bg-background px-4">
        {props.header}
      </header>
      <main className="flex-1 overflow-auto h-[calc(100vh-80px)] bg-background">
        {props.children}
      </main>
      <footer className="flex h-[30px] items-center justify-between border-t border-border bg-background px-4">
        {props.footer}
      </footer>
    </BlankLayout>
  );
};

