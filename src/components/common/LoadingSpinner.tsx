export default function LoadingSpinner({
  size = 'md',
  message,
}: {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}) {
  const sizeClasses = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`
          ${sizeClasses[size]}
          rounded-full
          border-muted-light
          border-t-primary
          animate-spin
        `}
      />
      {message && (
        <p className="text-sm text-muted">{message}</p>
      )}
    </div>
  );
}
