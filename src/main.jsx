import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// No StrictMode: the editor engine owns the DOM inside the shell and must start exactly once.
createRoot(document.getElementById('root')).render(<App />);
