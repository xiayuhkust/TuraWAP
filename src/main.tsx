import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Polyfill Buffer and other globals for the browser environment
import { Buffer } from 'buffer';
import process from 'process';

if (typeof window !== 'undefined') {
  // Buffer polyfill
  window.Buffer = Buffer;
  
  // Global polyfills
  window.global = window;
  window.process = process;
  
  // Additional required globals
  const globals = {
    Buffer: Buffer,
    process: process,
    global: window,
  };
  
  Object.assign(window, globals);
  
  console.log('Polyfills initialized:', {
    hasBuffer: typeof window.Buffer !== 'undefined',
    hasProcess: typeof window.process !== 'undefined',
    hasGlobal: typeof window.global !== 'undefined'
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)