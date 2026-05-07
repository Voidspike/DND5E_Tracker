interface LoadingSkeletonProps {
  lines?: number;
  className?: string;
}

export default function LoadingSkeleton({ lines = 3, className = '' }: LoadingSkeletonProps) {
  return (
    <div className={`p-6 space-y-4 animate-pulse ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="h-4 bg-dnd-accent/20 rounded w-3/4" />
          {i < lines - 1 && <div className="h-3 bg-dnd-accent/15 rounded w-1/2" />}
        </div>
      ))}
    </div>
  );
}
