export default function LoadingSpinner({
  label = 'Loading…',
  fullHeight = true,
  spinnerClassName = '',
  labelClassName = '',
  className = '',
}) {
  const wrapper = fullHeight
    ? 'flex items-center justify-center min-h-[60vh]'
    : 'flex items-center justify-center';

  const defaultSpinner =
    'w-6 h-6 border-2 border-slate-100 border-t-[#0b3578] rounded-full animate-spin';

  const spinner = spinnerClassName ? spinnerClassName : defaultSpinner;

  return (
    <div className={`${wrapper} ${className}`.trim()}>
      <div className="flex flex-col items-center gap-3">
        <div className={spinner} aria-hidden="true" />
        {label ? (
          <span
            className={
              labelClassName ||
              'text-[10px] font-semibold text-slate-400 uppercase tracking-widest'
            }
          >
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}
