/**
 * DataProvider React context for mobile app.
 * Same pattern as the desktop app's provider-context.tsx.
 */

import React, { createContext, useContext } from 'react';
import type { DataProvider } from './data-provider';

const DataProviderContext = createContext<DataProvider | null>(null);

export function DataProviderRoot({
  provider,
  children,
}: {
  provider: DataProvider;
  children: React.ReactNode;
}) {
  return (
    <DataProviderContext.Provider value={provider}>
      {children}
    </DataProviderContext.Provider>
  );
}

export function useDataProvider(): DataProvider {
  const ctx = useContext(DataProviderContext);
  if (!ctx) {
    throw new Error('useDataProvider must be used within <DataProviderRoot>');
  }
  return ctx;
}
