import { Link } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import { CloseButton } from '../../shared/CloseButton';
export function DemoNotice() {
  const { enabled, account, error, clearError } = useDemo();
  return (
    <>
      <div className="demo-notice">
        <strong>{enabled ? 'Local development demo' : 'Community preview'}</strong>
        <span>Fictional profiles and local activity. No real requests or messages are sent.</span>
        {!account && enabled && <Link to="/demo">Choose a demo account →</Link>}
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}
          <CloseButton onClick={clearError} aria-label="Dismiss error" iconSize={16} />
        </div>
      )}
    </>
  );
}
