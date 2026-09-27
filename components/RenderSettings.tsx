import { createContext } from 'react';

// Presentation preferences are transient; they never change saved scene data.
export const RenderSettingsContext = createContext({ showLabels: true, night: false });
