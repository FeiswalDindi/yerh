import { useState, type FormEvent } from 'react';
type ProfileFields = { name: string; location: string; headline: string; bio: string };

export function ProfileForm({
  person,
  save,
}: {
  person: ProfileFields & { email: string };
  save: (fields: ProfileFields) => Promise<boolean> | boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [changes, setChanges] = useState<Partial<ProfileFields>>({});
  const [saved, setSaved] = useState(false);
  const { name, location, headline, bio } = { ...person, ...changes };
  const dirty =
    name.trim() !== person.name ||
    location.trim() !== person.location ||
    headline.trim() !== person.headline ||
    bio.trim() !== person.bio;

  function update(field: keyof ProfileFields, value: string) {
    setSaved(false);
    setChanges((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || busy) return;
    setBusy(true);
    setError('');
    try {
      if (await save({ name, location, headline, bio })) {
        setChanges({});
        setSaved(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="dashboard-profile-form" onSubmit={submit}>
      <section
        className="profile-panel dashboard-profile-card"
        aria-labelledby="personal-details-title"
      >
        <h2 id="personal-details-title">Personal details</h2>
        <dl className="dashboard-profile-email">
          <dt>Account email</dt>
          <dd>{person.email}</dd>
        </dl>
        <div className="workspace-form dashboard-profile-fields">
          <label>
            Full name
            <input
              autoComplete="name"
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(e) => update('name', e.target.value)}
            />
          </label>
          <label>
            City or county
            <input
              autoComplete="address-level2"
              required
              minLength={2}
              maxLength={80}
              value={location}
              onChange={(e) => update('location', e.target.value)}
            />
          </label>
        </div>
      </section>
      <section
        className="profile-panel dashboard-profile-card"
        aria-labelledby="community-details-title"
      >
        <h2 id="community-details-title">Community profile</h2>
        <p>Introduce yourself to other YERH members.</p>
        <div className="workspace-form dashboard-profile-fields">
          <label>
            Headline
            <input
              required
              minLength={3}
              maxLength={120}
              value={headline}
              onChange={(e) => update('headline', e.target.value)}
            />
          </label>
          <label>
            Bio
            <textarea
              required
              minLength={10}
              maxLength={600}
              rows={3}
              value={bio}
              onChange={(e) => update('bio', e.target.value)}
            />
          </label>
        </div>
      </section>
      {error && <p role="alert">{error}</p>}
      {dirty && (
        <div className="dashboard-profile-actions">
          <button className="text-link" type="button" onClick={() => setChanges({})}>
            Discard changes
          </button>
          <button className="button button-gold" type="submit" disabled={busy}>
            Save changes
          </button>
        </div>
      )}
      {saved && (
        <p role="status" className="form-success">
          Profile saved.
        </p>
      )}
    </form>
  );
}
