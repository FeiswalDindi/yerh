import { usePageTitle } from '../../shared/usePageTitle';
import { useState, type FormEvent } from 'react';
import { useDemo } from '../../app/useDemo';
import { PageIntro } from '../../shared/PageIntro';
import { DemoNotice } from '../demo/DemoNotice';
import type { DemoAccount } from '../../domain/demo';
import { Link } from 'react-router-dom';
function ProfileForm({ person }: { person: DemoAccount }) {
  const { execute } = useDemo();
  const [form, setForm] = useState({
    name: person.name,
    headline: person.headline,
    location: person.location,
    bio: person.bio,
  });
  const [saved, setSaved] = useState(false);
  function submit(e: FormEvent) {
    e.preventDefault();
    setSaved(execute({ type: 'profile', ...form }));
  }
  return (
    <form className="workspace-form" onSubmit={submit}>
      <label>
        Name
        <input
          required
          minLength={2}
          maxLength={80}
          value={form.name}
          onChange={(e) => {
            setSaved(false);
            setForm({ ...form, name: e.target.value });
          }}
        />
      </label>
      <label>
        Headline
        <input
          required
          minLength={3}
          maxLength={120}
          value={form.headline}
          onChange={(e) => {
            setSaved(false);
            setForm({ ...form, headline: e.target.value });
          }}
        />
      </label>
      <label>
        Location
        <input
          required
          minLength={2}
          maxLength={80}
          value={form.location}
          onChange={(e) => {
            setSaved(false);
            setForm({ ...form, location: e.target.value });
          }}
        />
      </label>
      <label>
        Bio
        <textarea
          required
          minLength={10}
          maxLength={600}
          rows={4}
          value={form.bio}
          onChange={(e) => {
            setSaved(false);
            setForm({ ...form, bio: e.target.value });
          }}
        />
      </label>
      <button className="button">Save demo profile</button>
      {saved && (
        <p role="status" className="form-success">
          Demo profile updated in this browser.
        </p>
      )}
    </form>
  );
}
export function ProfilePage() {
  usePageTitle('My profile');
  const { account } = useDemo();
  return account ? (
    <>
      <PageIntro
        eyebrow="My profile"
        title="Introduce yourself."
        description="Edit the fictional profile for this demo account. The account role cannot be changed here."
      />
      <section className="container section narrow-content">
        <DemoNotice />
        <Link className="text-link" to={`/network/members/${account.id}`}>
          View my community profile →
        </Link>
        <ProfileForm key={account.id} person={account} />
      </section>
    </>
  ) : null;
}
