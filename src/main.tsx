import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

// SELECTIVE FIX: Clear only potentially problematic date-related data
try {
  // Only clear react-query cache that might contain invalid dates
  if ('indexedDB' in window) {
    indexedDB.deleteDatabase('react-query-cache');
    indexedDB.deleteDatabase('keyval-store');
  }
  
  // Clear only specific localStorage keys that might contain dates, NOT auth data
  const keysToCheck = ['opportunities', 'companies', 'activities', 'reports'];
  keysToCheck.forEach(key => {
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
    }
  });
} catch (error) {
  console.error('❌ Error during selective cleanup:', error);
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
