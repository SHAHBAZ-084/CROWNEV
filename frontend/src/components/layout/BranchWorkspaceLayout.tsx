import { Outlet } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardShell } from './DashboardShell';
import { useAuth } from '../../contexts/AuthContext';
import { posSections } from '../../config/posNavigation';

export { posSections };

export function openBranchWorkspace(path = '/branch/workspace/pos') {
  const url = `${window.location.origin}${path}`;
  window.open(
    url,
    'crown-ev-branch-workspace',
    'noopener,noreferrer,width=1440,height=920,menubar=no,toolbar=no,location=no,status=no'
  );
}

export function BranchWorkspaceLayout() {
  const { user, logout } = useAuth();

  return (
    <DashboardShell
      sidebar={({ mobileOpen, onNavigate }) => (
        <DashboardSidebar
          sections={posSections}
          role="BRANCH_OWNER"
          showBadge={false}
          userName={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()}
          userEmail={user?.email}
          userMeta={user?.branchId ? `Branch #${user.branchId}` : undefined}
          mobileOpen={mobileOpen}
          onNavigate={onNavigate}
          onSignOut={() => logout()}
          footerExtra={
            <a
              href="/branch"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-text-muted transition-colors hover:bg-accent/5 hover:text-brand"
            >
              <ExternalLink className="h-4 w-4 shrink-0" />
              Main dashboard
            </a>
          }
        />
      )}
    >
      <Outlet />
    </DashboardShell>
  );
}
