import { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent } from '../ui/card';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class WalletErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Wallet error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-red-500">
              Wallet display error. Please refresh the page.
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
