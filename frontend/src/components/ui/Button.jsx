import { Loader2 } from 'lucide-react';

export default function Button({
  variant = 'primary', size = 'md', loading = false, icon: Icon, children, className = '', fullWidth = false, ...props
}) {
  return (
    <button
      type="button"
      className={`btn btn--${variant} btn--${size} ${fullWidth ? 'btn--block' : ''} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Loader2 size={16} className="spin" /> : Icon ? <Icon size={16} /> : null}
      {children}
    </button>
  );
}
