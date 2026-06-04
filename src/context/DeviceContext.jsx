import { createContext, useContext } from 'react';

export const DeviceCtx = createContext(null);
export const useDevice = () => {
  const ctx = useContext(DeviceCtx);
  if (!ctx) throw new Error('useDevice must be used within DeviceProvider');
  return ctx;
};
