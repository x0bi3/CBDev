import { createContext, useContext } from 'react';

export const DeviceCtx = createContext(null);
export const useDevice = () => useContext(DeviceCtx);
