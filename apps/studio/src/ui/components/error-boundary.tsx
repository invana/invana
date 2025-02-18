import { TriangleAlert } from 'lucide-react';
import { Component, ReactNode } from 'react';


export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }
  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return <div className='text-sm inline-flex items-center'>
        <TriangleAlert className='mr-1 h-4' />
        Error loading component</div>;
    }
    return this.props.children;
  }
}


