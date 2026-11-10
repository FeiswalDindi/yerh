import type { FormEvent } from 'react';
import type { Incubation, Opportunity, PlatformAction } from '../../domain/platform';

type Save = (action: PlatformAction) => boolean;
export function OpportunityForm({
  opportunity: o,
  ownerId,
  organiser,
  image,
  onSave,
}: {
  opportunity?: Opportunity;
  ownerId: string;
  organiser: string;
  image: string;
  onSave: Save;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const node = event.currentTarget;
    const f = new FormData(node);
    const get = (key: string) => String(f.get(key) ?? '').trim();
    const list = (key: string) =>
      get(key)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    const id = o?.id ?? crypto.randomUUID();
    const deadline = get('deadline');
    const now = new Date().toISOString();
    const saved = onSave({
      type: 'opportunity-save',
      now,
      opportunity: {
        id,
        slug: o?.slug ?? `opportunity-${id}`,
        ownerId,
        title: get('title'),
        summary: get('summary'),
        description: get('description'),
        category: get('category'),
        organiser,
        type: get('type') as Opportunity['type'],
        mode: get('mode') as Opportunity['mode'],
        location: get('location'),
        sectors: list('sectors'),
        stages: list('stages'),
        eligibility: get('eligibility'),
        benefits: get('benefits'),
        documents: list('documents'),
        opensAt: o?.opensAt ?? now,
        deadline: deadline ? new Date(`${deadline}T17:00:00+03:00`).toISOString() : null,
        rolling: !deadline,
        externalUrl: get('externalUrl'),
        status: 'draft',
        featured: o?.featured ?? false,
        image: o?.image ?? image,
        capacity: get('capacity') ? Number(get('capacity')) : null,
        publishedAt: o?.publishedAt ?? null,
      },
    });
    if (saved && !o) node.reset();
  }
  return (
    <form className="workspace-form" onSubmit={submit}>
      <label>
        Title
        <input name="title" required minLength={5} maxLength={140} defaultValue={o?.title} />
      </label>
      <label>
        Summary
        <input name="summary" required minLength={20} maxLength={400} defaultValue={o?.summary} />
      </label>
      <label>
        Description
        <textarea
          name="description"
          required
          minLength={30}
          maxLength={5000}
          defaultValue={o?.description}
        />
      </label>
      <div className="form-field-grid">
        <label>
          Category
          <input name="category" required defaultValue={o?.category} />
        </label>
        <label>
          Application route
          <select name="type" defaultValue={o?.type ?? 'internal'}>
            <option value="internal">Apply on YERH</option>
            <option value="external">External application</option>
          </select>
        </label>
        <label>
          Delivery
          <select name="mode" defaultValue={o?.mode ?? 'online'}>
            <option value="online">Online</option>
            <option value="in_person">In person</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </label>
      </div>
      <label>
        Location
        <input name="location" required defaultValue={o?.location ?? 'Kenya'} />
      </label>
      <label>
        Sectors (comma-separated)
        <input name="sectors" required defaultValue={o?.sectors.join(', ')} />
      </label>
      <label>
        Venture stages (comma-separated)
        <input name="stages" required defaultValue={o?.stages.join(', ')} />
      </label>
      <label>
        Eligibility
        <textarea name="eligibility" required minLength={10} defaultValue={o?.eligibility} />
      </label>
      <label>
        Benefits
        <textarea name="benefits" required minLength={10} defaultValue={o?.benefits} />
      </label>
      <label>
        Documents to prepare (comma-separated)
        <input name="documents" defaultValue={o?.documents.join(', ')} />
      </label>
      <label>
        External application URL (required for external opportunities)
        <input name="externalUrl" type="url" placeholder="https://" defaultValue={o?.externalUrl} />
      </label>
      <div className="form-field-grid">
        <label>
          Deadline (blank for rolling) · 5 pm EAT
          <input name="deadline" type="date" defaultValue={o?.deadline?.slice(0, 10)} />
        </label>
        <label>
          Application limit (blank for unlimited)
          <input name="capacity" type="number" min={1} step={1} defaultValue={o?.capacity ?? ''} />
        </label>
      </div>
      <button className="button">{o ? 'Save changes as draft' : 'Save opportunity draft'}</button>
    </form>
  );
}

export function MilestoneEditor({
  incubationId,
  milestone: m,
  onSave,
}: {
  incubationId: string;
  milestone: Incubation['milestones'][number];
  onSave: Save;
}) {
  return (
    <details className="milestone-editor">
      <summary>
        {m.title} · {m.validated ? 'Validated' : 'In progress'}
      </summary>
      <form
        className="workspace-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          onSave({
            type: 'milestone',
            id: incubationId,
            milestoneId: m.id,
            title: String(f.get('title')),
            note: String(f.get('note')),
            validated: f.get('validated') === 'on',
            now: new Date().toISOString(),
          });
        }}
      >
        <label>
          Title
          <input name="title" required minLength={3} defaultValue={m.title} />
        </label>
        <label>
          Progress notes
          <textarea name="note" required minLength={10} defaultValue={m.note} />
        </label>
        <label className="inline-checkbox">
          <input type="checkbox" name="validated" defaultChecked={m.validated} />
          Validate milestone
        </label>
        <button className="button button-outline">Update milestone</button>
      </form>
    </details>
  );
}
