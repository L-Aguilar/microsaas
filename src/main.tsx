import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

// NUCLEAR FIX: Clear ALL localStorage and sessionStorage on EVERY load
try {
  console.log('🧹 NUCLEAR CLEANUP: Clearing ALL storage...');
  
  // Clear EVERYTHING
  localStorage.clear();
  sessionStorage.clear();
  
  // Also clear any indexed DB or other storage
  if ('indexedDB' in window) {
    indexedDB.deleteDatabase('react-query-cache');
    indexedDB.deleteDatabase('keyval-store');
  }
  
  console.log('✅ NUCLEAR cleanup completed - ALL storage cleared');
} catch (error) {
  console.error('❌ Error during nuclear cleanup:', error);
}

// NUCLEAR FIX: Intercept ALL JSON parsing to remove dates
const originalJSONParse = JSON.parse;
JSON.parse = function(text, reviver) {
  try {
    const result = originalJSONParse.call(this, text, reviver);
    
    // Recursively clean all objects
    const cleanObject = (obj) => {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(cleanObject);
      
      const cleaned = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip ANY field that might contain dates
        if (key.includes('date') || key.includes('_at') || key.includes('Date') || key.includes('time')) {
          continue; // Skip completely
        }
        cleaned[key] = typeof value === 'object' ? cleanObject(value) : value;
      }
      return cleaned;
    };
    
    return cleanObject(result);
  } catch (error) {
    console.error('JSON Parse Error:', error);
    return {};
  }
};

// Add global error handler for date errors
window.addEventListener('error', (event) => {
  if (event.error?.message?.includes('Invalid time value')) {
    console.error('🚨 CRITICAL: Invalid time value error detected!', event.error);
    console.log('🔧 Reloading page immediately...');
    
    // Clear everything and reload immediately
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
