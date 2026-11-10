import { Link } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
export function DemoNotice() {
  const { enabled, account, error, clearError } = useDemo();
  return (
    <>
      <div className="demo-notice">
        <strong>{enabled ? 'Local development demo' : 'Community preview'}</strong>
        <span>Fictional profiles and local activity. No real requests or messages are sent.</span>
        {!account && enabled && <Link to="/login">Choose a demo account →</Link>}
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}
          <button type="button" onClick={clearError} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}
    </>
  );
}
