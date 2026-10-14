import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Architecture from './entry';
createRoot(document.getElementById('root')!).render(<StrictMode><Architecture/></StrictMode>);
