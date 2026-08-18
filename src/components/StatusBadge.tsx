import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'open' | 'claimed' | 'submitted' | 'verified' | 'rejected' | 'disputed';
  className?: string;
}

const labels: Record<string, string> = {
  open: 'Open',
  claimed: 'Claimed',
  submitted: 'Pending Review',
  verified: '✓ Verified',
  rejected: '✗ Rejected',
  disputed: 'Disputed',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={cn('status-badge', `status-${status}`, className)}>
      {labels[status]}
    </span>
  );
}
