import React from 'react';

interface AppMainProps {
  children: React.ReactNode;
}

export const AppMain: React.FC<AppMainProps> = ({ children }) => {
  return (
    <main className="flex-1 overflow-auto w-full h-[calc(100vh-80px)] bg-background">
      {children}
    </main>
  );
};

