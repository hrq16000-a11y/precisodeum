import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface AdDebugState {
  /** X-Ray mode: force-show all ad slots with neon highlight */
  xrayEnabled: boolean;
  /** Simulated city override (admin only) */
  simulatedCity: string | null;
  /** Simulated state override (admin only) */
  simulatedState: string | null;
  toggleXray: () => void;
  setSimulatedLocation: (city: string | null, state: string | null) => void;
}

const AdDebugContext = createContext<AdDebugState>({
  xrayEnabled: false,
  simulatedCity: null,
  simulatedState: null,
  toggleXray: () => {},
  setSimulatedLocation: () => {},
});

export function AdDebugProvider({ children }: { children: ReactNode }) {
  const [xrayEnabled, setXrayEnabled] = useState(false);
  const [simulatedCity, setSimCity] = useState<string | null>(null);
  const [simulatedState, setSimState] = useState<string | null>(null);

  const toggleXray = useCallback(() => setXrayEnabled(v => !v), []);
  const setSimulatedLocation = useCallback((city: string | null, state: string | null) => {
    setSimCity(city);
    setSimState(state);
  }, []);

  return (
    <AdDebugContext.Provider value={{ xrayEnabled, simulatedCity, simulatedState, toggleXray, setSimulatedLocation }}>
      {children}
    </AdDebugContext.Provider>
  );
}

export function useAdDebug() {
  return useContext(AdDebugContext);
}
