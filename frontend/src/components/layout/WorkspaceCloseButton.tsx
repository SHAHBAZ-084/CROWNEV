import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';

export const WORKSPACE_HOME = '/branch/workspace/pos';

export function WorkspaceCloseButton({ className }: { className?: string }) {
  const navigate = useNavigate();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      onClick={() => navigate(WORKSPACE_HOME)}
    >
      Close
    </Button>
  );
}

export function WorkspaceCloseBar({ className }: { className?: string }) {
  return (
    <div className={`flex justify-end border-t border-border/60 pt-5 ${className ?? ''}`}>
      <WorkspaceCloseButton />
    </div>
  );
}
