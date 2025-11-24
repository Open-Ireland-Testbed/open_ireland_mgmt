// TODO: Implement component (placeholder)
import React from 'react';

export default function Toast({ 
  message, 
  type = 'info', 
  onClose, 
  duration = 5000 
}) {
  React.useEffect(() => {
    if (duration > 0 && onClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  return (
    <div className={`toast toast-${type}`}>
      <span className="toast-message">{message}</span>
      {onClose && (
        <button className="toast-close" onClick={onClose}>×</button>
      )}
    </div>
  );
}

