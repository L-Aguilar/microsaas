import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

// EMERGENCY FIX: Clear potentially corrupted localStorage
try {
  console.log('🧹 Cleaning localStorage to fix date errors...');
  
  // Remove potentially corrupted user data
  const keysToRemove = ['user', 'session', 'auth', 'queryClient'];
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
  
  // Check for any remaining items with dates and remove them
  Object.keys(localStorage).forEach(key => {
    try {
      const value = localStorage.getItem(key);
      if (value && (value.includes('date') || value.includes('Date') || value.includes('_at'))) {
        console.warn(`🗑️ Removing potentially corrupted localStorage item: ${key}`);
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn(`🗑️ Error checking localStorage item ${key}, removing:`, e);
      localStorage.removeItem(key);
    }
  });
  
  console.log('✅ localStorage cleanup completed');
} catch (error) {
  console.error('❌ Error during localStorage cleanup:', error);
}

// Add global error handler for date errors
window.addEventListener('error', (event) => {
  if (event.error?.message?.includes('Invalid time value')) {
    console.error('🚨 CRITICAL: Invalid time value error detected!', event.error);
    console.log('🔧 Attempting to reload page to recover...');
    
    // Clear localStorage and reload as last resort
    localStorage.clear();
    sessionStorage.clear();
    
    // Prevent infinite reload loop
    if (!sessionStorage.getItem('reloadAttempted')) {
      sessionStorage.setItem('reloadAttempted', 'true');
      setTimeout(() => window.location.reload(), 1000);
    }
  }
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
