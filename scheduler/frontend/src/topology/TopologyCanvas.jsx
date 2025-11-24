import React from 'react';
import ReactFlow from 'reactflow';
import 'reactflow/dist/style.css';

// Simple ErrorBoundary for React Flow
class TopologyCanvasErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    // Suppress ResizeObserver errors - they're benign
    if (error?.message?.includes('ResizeObserver') || error?.toString()?.includes('ResizeObserver')) {
      return { hasError: false };
    }
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Suppress ResizeObserver errors in console
    if (error?.message?.includes('ResizeObserver') || error?.toString()?.includes('ResizeObserver')) {
      return;
    }
    console.error('TopologyCanvas error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

export default function TopologyCanvas({ children, ...props }) {
  return (
    <TopologyCanvasErrorBoundary>
      <div
        id="reactflow-wrapper"
        className="reactflow-wrapper"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          backgroundColor: '#fafafa',
        }}
      >
        <ReactFlow
          fitView
          minZoom={0.2}
          maxZoom={1.5}
          nodesDraggable
          nodesConnectable
          {...props}
        >
          {children}
        </ReactFlow>
      </div>
    </TopologyCanvasErrorBoundary>
  );
}

