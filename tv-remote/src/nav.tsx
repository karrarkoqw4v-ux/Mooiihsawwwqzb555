import React, { createContext, useContext, useState } from 'react';

export type Route =
  | 'remote' | 'settings' | 'remoteStyle' | 'behavior' | 'manageApps' | 'devices'
  | 'tvPicker' | 'keyboard' | 'addApp';

interface Nav { route: Route; stack: Route[]; push: (r: Route) => void; pop: () => void; }
const Ctx = createContext<Nav>(null as any);
export const useNav = () => useContext(Ctx);

export function NavProvider({ initial = 'remote', children }: { initial?: Route; children: React.ReactNode }) {
  const [stack, setStack] = useState<Route[]>([initial]);
  const value: Nav = {
    route: stack[stack.length - 1],
    stack,
    push: (r) => setStack((s) => [...s, r]),
    pop: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
