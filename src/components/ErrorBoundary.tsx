import React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 ErrorBoundary caught an error:', error, errorInfo);
    
    // Check if it's a date-related error
    if (error.message?.includes('Invalid time value') || error.name === 'RangeError') {
      console.error('🔥 DATE ERROR DETECTED! Clearing localStorage...');
      
      try {
        localStorage.clear();
        sessionStorage.clear();
        
        // Force reload after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } catch (e) {
        console.error('Failed to clear storage:', e);
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <h1>🚨 Application Error</h1>
          <p>Something went wrong. The page will reload automatically...</p>
          
          {this.state.error?.message?.includes('Invalid time value') && (
            <>
              <p><strong>Date Error Detected!</strong></p>
              <p>Clearing corrupted data and reloading...</p>
              <div>⏳ Please wait...</div>
            </>
          )}
          
          <details style={{ marginTop: '20px', textAlign: 'left' }}>
            <summary>Technical Details</summary>
            <pre style={{
              background: '#f5f5f5',
              padding: '10px',
              borderRadius: '4px',
              fontSize: '12px'
            }}>
              {this.state.error?.stack}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;