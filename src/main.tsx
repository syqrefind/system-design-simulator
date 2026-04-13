import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

// StrictMode intentionally omitted: PixiJS async init does not survive
// the double-effect that StrictMode uses to detect side-effect leaks.
createRoot(root).render(<App />);
