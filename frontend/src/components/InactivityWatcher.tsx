import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useInactivityLogout } from '../hooks/useInactivityLogout';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

const SESSION_EXPIRED_MESSAGE = 'Your session has expired due to inactivity. Please log in again.';

export function InactivityWatcher() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [sessionExpiredOpen, setSessionExpiredOpen] = useState(false);

  const handleExpire = useCallback(() => {
    logout();
    toast(SESSION_EXPIRED_MESSAGE, 'info');
    setSessionExpiredOpen(true);
  }, [logout, toast]);

  useInactivityLogout({
    enabled: user !== null,
    onExpire: handleExpire,
  });

  useEffect(() => {
    if (user) setSessionExpiredOpen(false);
  }, [user]);

  return (
    <Modal
      open={sessionExpiredOpen}
      onClose={() => setSessionExpiredOpen(false)}
      title="Session expired"
      size="sm"
    >
      <p className="text-sm text-text-muted">{SESSION_EXPIRED_MESSAGE}</p>
      <div className="mt-6 flex justify-end">
        <Link to="/login" onClick={() => setSessionExpiredOpen(false)}>
          <Button variant="accent">Log in</Button>
        </Link>
      </div>
    </Modal>
  );
}
