import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface ReconnectDialogProps {
  open: boolean;
  onClose: () => void;
  onReconnect: (password: string) => Promise<void>;
  onClearAccount: () => void;
}

export const ReconnectDialog: React.FC<ReconnectDialogProps> = ({
  open,
  onClose,
  onReconnect,
  onClearAccount,
}) => {
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleReconnect = async () => {
    if (!password) return;
    
    try {
      setLoading(true);
      setError(null);
      await onReconnect(password);
      setPassword('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reconnect');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        setPassword('');
        setError(null);
      }
      onClose();
    }}>
      <DialogContent className="sm:max-w-[425px] bg-[#313338] border-[#393B40]">
        <DialogHeader>
          <DialogTitle className="text-white">Session Expired</DialogTitle>
          <DialogDescription className="text-gray-300">
            Your session has expired. Please enter your password to reconnect or clear your account.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Input
            id="password"
            type="password"
            placeholder="Enter your wallet password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && password) {
                handleReconnect();
              }
            }}
            className="col-span-3 bg-[#383a40] text-white border-[#393B40]"
          />
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
        <DialogFooter>
          <div className="flex justify-between w-full">
            <Button
              variant="destructive"
              onClick={onClearAccount}
              disabled={loading}
              className="bg-[#2b2d31] hover:bg-[#2F3136]"
            >
              Clear Account
            </Button>
            <Button
              onClick={handleReconnect}
              disabled={!password || loading}
              className="bg-[#2b2d31] text-white hover:bg-[#2F3136]"
            >
              {loading ? 'Reconnecting...' : 'Reconnect'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
