import * as React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      <DialogContent className="sm:max-w-[425px] bg-[#2B2D31] border-[#393B40]">
        <DialogHeader>
          <DialogTitle className="text-[#F2F3F5]">{t('sessionExpired')}</DialogTitle>
          <DialogDescription className="text-[#949BA4]">
            {t('sessionExpiredDesc')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Input
            id="password"
            type="password"
            placeholder={t('enterPassword')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && password) {
                handleReconnect();
              }
            }}
            className="col-span-3"
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
            >
              {t('clearAccount')}
            </Button>
            <Button
              onClick={handleReconnect}
              disabled={!password || loading}
            >
              {loading ? t('reconnecting') : t('reconnect')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
