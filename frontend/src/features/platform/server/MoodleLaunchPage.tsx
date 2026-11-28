import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useLaravelSession } from '../../../app/useLaravelSession';
import { learningRepository } from '../../../services/laravel-learning-repository';
import { SiteLoader } from '../../../shared/SiteLoader';

/**
 * Full-screen heartbeat handoff screen shown continuously while Laravel prepares Moodle SSO
 * and hands off to Moodle's own branded redirect screen (eliminating any blank white flash).
 */
export function MoodleLaunchPage() {
  const [params] = useSearchParams();
  const { search } = useLocation();
  const session = useLaravelSession();
  const [showFallback, setShowFallback] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const slug = params.get('slug');
  const path = params.get('path');
  const schoolGuide = params.get('school_guide');
  const directTarget = learningRepository.moodleApiLaunchUrl({
    slug,
    path,
    school_guide: schoolGuide,
  });
  const jsonTarget = learningRepository.moodleApiLaunchUrl({
    slug,
    path,
    school_guide: schoolGuide,
    format: 'json',
  });
  const readyToLaunch = Boolean(session && !session.loading && session.profile?.email_verified);

  useEffect(() => {
    if (!readyToLaunch) return;

    const controller = new AbortController();
    let active = true;
    setLaunchError(null);
    setShowFallback(false);

    const fallbackTimer = window.setTimeout(() => {
      if (active) setShowFallback(true);
    }, 6000);

    async function launch() {
      try {
        const response = await fetch(jsonTarget, {
          method: 'GET',
          credentials: 'include',
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
        });
        const payload = (await response.json().catch(() => null)) as {
          data?: { url?: string };
          message?: string;
        } | null;

        if (!active) return;

        if (!response.ok || !payload?.data?.url) {
          setLaunchError(
            payload?.message || 'Could not open YERH Learning right now. Please try again.',
          );
          return;
        }

        const moodleUrl = payload.data.url;
        setResolvedUrl(moodleUrl);
        window.location.replace(moodleUrl);
      } catch (cause) {
        if (!active || controller.signal.aborted) return;
        setLaunchError(
          cause instanceof Error
            ? cause.message
            : 'Could not reach YERH Learning right now. Please try again.',
        );
      }
    }

    void launch();

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(fallbackTimer);
    };
  }, [readyToLaunch, jsonTarget, attempt]);

  if (!session || session.loading) {
    return <SiteLoader screen heartbeat message="Connecting to YERH Learning…" />;
  }

  if (!session.profile) {
    return (
      <Navigate to={`/login?redirect=${encodeURIComponent(`/moodle/launch${search}`)}`} replace />
    );
  }

  if (!session.profile.email_verified) {
    return <Navigate to="/account" replace />;
  }

  if (launchError) {
    return (
      <section
        className="yerh-loader yerh-loader--screen"
        role="alert"
        aria-label="Moodle launch failed"
      >
        <div className="yerh-loader__stack" style={{ maxWidth: 440 }}>
          <p className="yerh-loader__wait">Unable to open YERH Learning</p>
          <p className="yerh-loader__message">{launchError}</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              className="button button-gold"
              onClick={() => setAttempt((n) => n + 1)}
            >
              Try again
            </button>
            <Link className="button button-outline" to="/learn">
              Back to courses
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <SiteLoader screen heartbeat message="Opening YERH Learning…" />
      {showFallback && (
        <div
          style={{
            position: 'fixed',
            insetInline: 0,
            bottom: '18vh',
            display: 'flex',
            justifyContent: 'center',
            paddingInline: 16,
          }}
        >
          <a className="button button-gold" href={resolvedUrl || directTarget}>
            Continue to Moodle
          </a>
        </div>
      )}
    </div>
  );
}
