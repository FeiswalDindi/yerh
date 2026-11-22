import { useState, type FormEvent } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { AccountLink } from '../accounts/AccountLink';
import { roleAccessPath } from '../accounts/role-requests';
import { CalendarDays, ArrowUpRight, MapPin, Star } from 'lucide-react';
import { useDemo } from '../../app/useDemo';
import { can } from '../../domain/roles';
import { opportunityProblem } from '../../domain/platform-actions';
import type { Opportunity } from '../../domain/platform';
import { PageIntro } from '../../shared/PageIntro';
import { DemoNotice } from '../demo/DemoNotice';
import { NotFoundPage } from '../info/NotFoundPage';
import { usePageTitle } from '../../shared/usePageTitle';
import { dashboardCataloguePaths } from '../dashboard/catalogue-paths';

export function OpportunityCard({
  opportunity: o,
  listing = '/opportunities',
  search = '',
}: {
  opportunity: Opportunity;
  listing?: string;
  search?: string;
}) {
  const detail = `${listing}/${encodeURIComponent(o.slug)}${search}`;
  const closed = !!opportunityProblem(o, new Date().toISOString());
  const scheduled = o.status === 'published' && !!o.opensAt && Date.parse(o.opensAt) > Date.now();
  return (
    <article
      className={`benefit-card ${o.featured ? 'benefit-featured' : ''} ${closed ? 'is-closed' : ''}`}
    >
      <Link to={detail} tabIndex={-1} aria-hidden="true">
        <img src={o.image || '/media/be-part-of-the-team-3382b8d1.jpg'} alt="" loading="lazy" />
      </Link>
      <div>
        <div className="tag-list">
          {o.featured && (
            <span className="opportunity-featured-badge">
              <Star size={12} aria-hidden="true" /> Featured
            </span>
          )}
          <span>{scheduled ? 'Opening soon' : closed ? 'Closed' : 'Open'}</span>
          <span>{o.type}</span>
        </div>
        <p className="eyebrow">
          {o.organiser} · {o.category}
        </p>
        <h3>
          <Link to={detail}>{o.title}</Link>
        </h3>
        <p className="opportunity-summary">{o.summary}</p>
        <div className="opportunity-meta">
          <span>
            <CalendarDays size={14} aria-hidden="true" />
            {o.rolling
              ? 'Rolling applications'
              : o.deadline
                ? new Date(o.deadline).toLocaleDateString('en-KE')
                : 'See details'}
          </span>
          <span>
            <MapPin size={14} aria-hidden="true" />
            {o.mode === 'online' ? 'Online' : o.location}
          </span>
        </div>
        <Link className="text-link" to={detail}>
          View opportunity <ArrowUpRight size={15} />
        </Link>
      </div>
    </article>
  );
}
export function OpportunitiesPage({ dashboard = false }: { dashboard?: boolean }) {
  const { state } = useDemo();
  const [params, setParams] = useSearchParams();
  const { search } = useLocation();
  usePageTitle('Opportunities');
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? 'all';
  const status = params.get('status') ?? (dashboard ? 'all' : 'open');
  const listing = dashboard ? dashboardCataloguePaths.opportunities : '/opportunities';
  const deadline = params.get('deadline') ?? '';
  const sort = params.get('sort') ?? 'deadline';
  const currentTime = new Date().toISOString();
  const availableStatus = (o: Opportunity) =>
    o.status === 'published' && o.opensAt && Date.parse(o.opensAt) > Date.now()
      ? 'upcoming'
      : opportunityProblem(o, currentTime)
        ? 'closed'
        : 'open';
  const publicItems = state.platform.opportunities.filter((o) =>
    ['published', 'closed'].includes(o.status),
  );
  const categories = [...new Set(publicItems.map((o) => o.category))];
  const results = publicItems
    .filter(
      (o) =>
        (category === 'all' || o.category === category) &&
        `${o.title} ${o.summary} ${o.organiser} ${o.sectors.join(' ')}`
          .toLowerCase()
          .includes(q.toLowerCase()) &&
        (status === 'all' || status === availableStatus(o)) &&
        (!deadline || !o.deadline || o.deadline.slice(0, 10) <= deadline),
    )
    .sort((a, b) =>
      sort === 'newest'
        ? (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '')
        : sort === 'title'
          ? a.title.localeCompare(b.title)
          : (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'),
    );

  const featured = results.filter((o) => o.featured);
  const remaining = results.filter((o) => !o.featured);
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next, { replace: true });
  }
  return (
    <>
      <PageIntro
        eyebrow={dashboard ? 'Opportunities' : 'Benefits · Opportunities'}
        title={dashboard ? 'Opportunities' : 'Your next opportunity starts here.'}
        description="Funding, market access and practical support for youth-led ventures."
      />
      <section className="container section">
        <DemoNotice />
        <div className="benefit-toolbar">
          <label>
            Search
            <input
              type="search"
              value={q}
              onChange={(e) => filter('q', e.target.value)}
              placeholder="Search opportunities, organisers, sectors…"
            />
          </label>
          <label>
            Category
            <select value={category} onChange={(e) => filter('category', e.target.value)}>
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={status} onChange={(e) => filter('status', e.target.value)}>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="upcoming">Opening soon</option>
              <option value="all">All opportunities</option>
            </select>
          </label>
          <label>
            Deadline on or before
            <input
              type="date"
              value={deadline}
              onChange={(e) => filter('deadline', e.target.value)}
            />
          </label>
          <label>
            Sort by
            <select value={sort} onChange={(e) => filter('sort', e.target.value)}>
              <option value="deadline">Nearest deadline</option>
              <option value="newest">Recently published</option>
              <option value="title">Title</option>
            </select>
          </label>
          <button className="text-link" onClick={() => setParams({})}>
            Reset
          </button>
        </div>
        <p className="result-count" role="status">
          {results.length} opportunities
        </p>
        {featured.length > 0 && (
          <section className="opportunity-section" aria-labelledby="featured-opportunities">
            <div className="opportunity-section-heading">
              <h2 id="featured-opportunities">
                <Star size={20} aria-hidden="true" /> Featured opportunities
              </h2>
              <span>{featured.length} featured</span>
            </div>
            <div className="benefit-grid">
              {featured.map((o) => (
                <OpportunityCard key={o.id} opportunity={o} listing={listing} search={search} />
              ))}
            </div>
          </section>
        )}
        {remaining.length > 0 && (
          <section className="opportunity-section" aria-labelledby="more-opportunities">
            <div className="opportunity-section-heading">
              <h2 id="more-opportunities">
                {featured.length ? 'More opportunities' : 'All opportunities'}
              </h2>
            </div>
            <div className="benefit-grid">
              {remaining.map((o) => (
                <OpportunityCard key={o.id} opportunity={o} listing={listing} search={search} />
              ))}
            </div>
          </section>
        )}
        {!results.length && <p className="empty-state">No opportunities match these filters.</p>}
      </section>
    </>
  );
}
export function OpportunityDetail({ dashboard = false }: { dashboard?: boolean }) {
  const { slug } = useParams();
  const { search } = useLocation();
  const { state, account, execute } = useDemo();
  const [compose, setCompose] = useState(false);
  const opportunity = state.platform.opportunities.find(
    (o) => (o.slug === slug || o.id === slug) && ['published', 'closed'].includes(o.status),
  );
  usePageTitle(opportunity?.title ?? 'Opportunity not found');
  if (!opportunity) return <NotFoundPage />;
  const o = opportunity;
  const problem = opportunityProblem(o, new Date().toISOString());
  const application = state.platform.opportunityApplications.find(
    (a) => a.opportunityId === o.id && a.accountId === account?.id && a.status !== 'withdrawn',
  );
  const ventures = state.platform.ventures.filter(
    (v) => v.ownerId === account?.id && v.status === 'approved',
  );
  function apply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (
      execute({
        type: 'opportunity-apply',
        id: crypto.randomUUID(),
        opportunityId: o.id,
        ventureId: String(f.get('venture')),
        motivation: String(f.get('motivation')),
        now: new Date().toISOString(),
      })
    )
      setCompose(false);
  }
  return (
    <>
      <PageIntro eyebrow={`${o.category} · ${o.type}`} title={o.title} description={o.summary} />
      <section className="container section">
        <DemoNotice />
        <Link
          className="text-link"
          to={(dashboard ? dashboardCataloguePaths.opportunities : '/opportunities') + search}
        >
          ← All opportunities
        </Link>
        <div className="benefit-detail">
          <div className="benefit-prose">
            <img className="article-image" src={o.image} alt="" />
            <h2>About the opportunity</h2>
            <p>{o.description}</p>
            <h2>Benefits & value</h2>
            <p>{o.benefits}</p>
            <h2>Eligibility</h2>
            <p>{o.eligibility}</p>
            <div className="tag-list">
              {[...o.sectors, ...o.stages].map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
            <h2>Prepare your application</h2>
            <ul>
              {o.documents.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
            <p>
              Use the application form to describe your venture and motivation. Document uploads
              will be available with the backend integration.
            </p>
          </div>
          <aside className="profile-panel">
            <h2>Interested?</h2>
            <p>{o.organiser}</p>
            <p>
              {o.rolling
                ? 'Rolling deadline'
                : `Apply by ${new Date(o.deadline!).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })} EAT`}
            </p>
            <p>
              {o.mode} · {o.location}
            </p>
            {application ? <p role="status">Your application: {application.status}</p> : null}
            {problem ? (
              <p className="status-pill">{problem}</p>
            ) : application ? (
              <>
                <p role="status">Application: {application.status}</p>
                <button
                  className="text-link"
                  onClick={() =>
                    execute({
                      type: 'opportunity-review',
                      id: application.id,
                      status: 'withdrawn',
                      now: new Date().toISOString(),
                    })
                  }
                >
                  Withdraw application
                </button>
              </>
            ) : !account ? (
              <AccountLink
                className="button"
                search={`?${new URLSearchParams({ redirect: `/opportunities/${o.slug}` })}`}
              >
                Sign in to apply
              </AccountLink>
            ) : !can(account, 'apply') ? (
              <Link className="button" to={roleAccessPath}>
                {account.role === 'guest'
                  ? 'Apply for entrepreneur access'
                  : 'Request entrepreneur access'}
              </Link>
            ) : o.type === 'external' ? (
              <>
                <a className="button" href={o.externalUrl} target="_blank" rel="noreferrer">
                  Go to external application <ArrowUpRight size={16} />
                </a>
                <p className="source-note">
                  You will apply on the organiser’s website. External applications are not tracked
                  as submitted by YERH.
                </p>
              </>
            ) : ventures.length ? (
              <button className="button" onClick={() => setCompose(!compose)}>
                Apply or register interest
              </button>
            ) : (
              <Link className="button" to="/dashboard/workspace?tab=ventures">
                Create an approved venture first
              </Link>
            )}
            {compose && (
              <form className="workspace-form" onSubmit={apply}>
                <label>
                  Venture
                  <select name="venture" required>
                    {ventures.map((v) => (
                      <option value={v.id} key={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Why is your venture a good fit?
                  <textarea name="motivation" required minLength={30} maxLength={2000} />
                </label>
                <button className="button">Submit application</button>
              </form>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}
