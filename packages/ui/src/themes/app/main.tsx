import { cn } from '../../lib/utils';
import React from 'react';

interface AppMainProps {
  children: React.ReactNode;
  className?: string
}

export const AppMain: React.FC<AppMainProps> = ({ children, className }) => {
  return (
    <main className={(cn("flex-1  min-h-0 bg-background", className))}>
      {children}
    </main>
  );
};

