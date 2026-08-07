import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) { return { error }; }

  componentDidCatch(error, info) {
    if (process.env.NODE_ENV !== 'production') console.error('Application render failure', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4" role="alert">
        <div className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-10 w-10 text-[#7d4956]" aria-hidden="true" />
          <h1 className="display-serif mt-4 text-2xl font-semibold">We could not display this page</h1>
          <p className="mt-2 text-sm text-stone-600">Your account and order data are safe. Reload the application to try again.</p>
          <Button className="mt-6" onClick={() => window.location.reload()}>Reload RAW</Button>
        </div>
      </main>
    );
  }
}
