import './SkeletonLoader.css';

// Generic skeleton block
export function Skeleton({ width = '100%', height = '16px', borderRadius = '6px', className = '' }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height, borderRadius }}
    />
  );
}

// Stat card skeleton — matches .stat-card layout
export function StatCardSkeleton() {
  return (
    <div className="skeleton-stat-card">
      <div className="skeleton-stat-icon skeleton" />
      <div className="skeleton-stat-info">
        <Skeleton width="60%" height="12px" />
        <Skeleton width="80%" height="22px" borderRadius="4px" />
      </div>
    </div>
  );
}

// Table row skeletons
export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div className="skeleton-table">
      <div className="skeleton-table-head">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} width="80%" height="12px" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={ri} className="skeleton-table-row">
          {Array.from({ length: cols }).map((_, ci) => (
            <Skeleton key={ci} width={ci === 0 ? '70%' : '55%'} height="13px" />
          ))}
        </div>
      ))}
    </div>
  );
}

// Contributor card skeleton — matches .contributor-card layout
export function ContributorCardSkeleton() {
  return (
    <div className="skeleton-contributor-card">
      <div className="skeleton-card-header">
        <div className="skeleton skeleton-avatar" />
        <div className="skeleton-card-identity">
          <Skeleton width="65%" height="14px" />
          <Skeleton width="45%" height="11px" />
        </div>
        <Skeleton width="52px" height="22px" borderRadius="20px" />
      </div>
      <div className="skeleton-card-body">
        <Skeleton width="70%" height="12px" />
        <Skeleton width="60%" height="12px" />
        <div className="skeleton-card-amounts">
          <div><Skeleton width="40px" height="10px" /><Skeleton width="60px" height="14px" /></div>
          <div><Skeleton width="32px" height="10px" /><Skeleton width="60px" height="14px" /></div>
          <div><Skeleton width="56px" height="10px" /><Skeleton width="60px" height="14px" /></div>
        </div>
      </div>
      <div className="skeleton-card-footer">
        <Skeleton width="70px" height="11px" />
        <div className="skeleton-card-btns">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} width="28px" height="28px" borderRadius="6px" />
          ))}
        </div>
      </div>
    </div>
  );
}

// Grid of contributor card skeletons
export function ContributorsGridSkeleton({ count = 6 }) {
  return (
    <div className="skeleton-contributors-grid">
      {Array.from({ length: count }).map((_, i) => (
        <ContributorCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Stats row skeleton (4 or 5 cards)
export function StatsSkeleton({ count = 4 }) {
  return (
    <div className={`skeleton-stats-grid ${count === 5 ? 'skeleton-stats-grid-5' : ''}`}>
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}
