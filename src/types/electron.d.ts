/// <reference types="vite/client" />

declare module 'electron' {
  export const app: {
    whenReady: () => Promise<void>;
    quit: () => void;
    on: (event: string, callback: () => void) => void;
  };
  export const BrowserWindow: {
    new(options?: any): any;
    getAllWindows: () => any[];
  };
  export const contextBridge: {
    exposeInMainWorld: (name: string, api: any) => void;
  };
}
