import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'open' | 'claimed' | 'assigned' | 'submitted' | 'verified' | 'rejected' | 'disputed' | 'cancelled' | 'expired';
  className?: string;
}

const labels: Record<string, string> = {
  open: 'Open',
  claimed: 'Claimed',
  assigned: 'Assigned',
  submitted: 'Pending Review',
  verified: '✓ Verified',
  rejected: '✗ Rejected',
  disputed: 'Disputed',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={cn('status-badge', `status-${status}`, className)}>
      {labels[status]}
    </span>
  );
}
