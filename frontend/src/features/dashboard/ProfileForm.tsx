import { useState, type FormEvent } from 'react';
type ProfileFields = {
  first_name?: string;
  last_name?: string;
  name: string;
  location: string;
  headline: string;
  bio: string;
};

function splitDisplayName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] ?? '',
    last_name: parts.slice(1).join(' '),
  };
}

export function ProfileForm({
  person,
  splitName = false,
  save,
}: {
  person: ProfileFields & { email: string };
  splitName?: boolean;
  save: (fields: ProfileFields) => Promise<boolean> | boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [changes, setChanges] = useState<Partial<ProfileFields>>({});
  const [saved, setSaved] = useState(false);
  const initialSplit = splitDisplayName(person.name);
  const baseFirst = person.first_name ?? initialSplit.first_name;
  const baseLast = person.last_name ?? initialSplit.last_name;
  const firstName = changes.first_name ?? baseFirst;
  const lastName = changes.last_name ?? baseLast;
  const { name, location, headline, bio } = { ...person, ...changes };
  const dirty =
    (splitName
      ? firstName.trim() !== baseFirst.trim() || lastName.trim() !== baseLast.trim()
      : name.trim() !== person.name) ||
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
      const payload: ProfileFields = splitName
        ? {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            name: `${firstName.trim()} ${lastName.trim()}`.trim(),
            location,
            headline,
            bio,
          }
        : { name, location, headline, bio };
      if (await save(payload)) {
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
          {splitName ? (
            <>
              <label>
                First name
                <input
                  autoComplete="given-name"
                  required
                  minLength={1}
                  maxLength={80}
                  value={firstName}
                  onChange={(e) => update('first_name', e.target.value)}
                />
              </label>
              <label>
                Last name
                <input
                  autoComplete="family-name"
                  required
                  minLength={1}
                  maxLength={80}
                  value={lastName}
                  onChange={(e) => update('last_name', e.target.value)}
                />
              </label>
            </>
          ) : (
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
          )}
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
