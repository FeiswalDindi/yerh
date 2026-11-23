import { marketplaceSectors } from '../../../services/laravel-marketplace-sectors';
import { useCatalog } from '../../../app/useCatalog';
import { AdvertisementsWidget } from '../../discovery/AdvertisementsWidget';
import { MarketplaceSectorGrid } from '../../content/MarketplaceSectorGrid';
import { RegistryReview } from './RegistryReview';
import { useCallback } from 'react';
import { ArrowUpRight, Search } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { PageIntro } from '../../../shared/PageIntro';
import {
  laravelProgramme,
  publicMarketplace,
  publicProduct,
  type Product,
} from '../../../services/laravel-programme-repository';
import { laravelWorkspace } from '../../../services/laravel-workspace-repository';
import { WorkspaceTable } from '../workspace/WorkspaceControls';
import {
  DecisionAction,
  fieldValue,
  RecordsFeedback,
  useWorkspaceRecords,
  WorkspaceAction,
} from './WorkspaceActions';
import { formatKsh, RecordProgrammePayment } from './ProgrammeFinance';

export function ProductsWorkspace({ role }: { role: 'admin' | 'entrepreneur' | 'mentor' }) {
  const products = useWorkspaceRecords(laravelProgramme.products);
  const fees = useWorkspaceRecords(laravelProgramme.fees, role === 'entrepreneur');
  const listingFee = fees.records?.find((item) => item.purpose === 'marketplace' && item.enabled);
  if (role === 'admin')
    return (
      <>
        <RecordsFeedback loading={!products.records} error={products.error} />
        {products.records && (
          <WorkspaceTable
            label="marketplace products"
            columns={['Name', 'Owner', 'Status', 'Marketplace', 'Action']}
            rows={products.records.map((p) => ({
              id: String(p.id),
              search: [p.name, p.owner, p.venture, p.moderation].join(' '),
              cells: [
                p.name,
                p.owner,
                <span className="workspace-status" data-status={p.moderation}>
                  {p.moderation}
                </span>,
                p.published ? <Link to={'/marketplace/' + p.slug}>Live</Link> : 'Private',
                <RegistryReview
                  current={p.moderation}
                  name={p.name}
                  description={p.description}
                  note={p.moderation_note}
                  decide={async (d, n) => {
                    await laravelProgramme.reviewProduct(p.id, 'listing', d, n, p.moderation);
                    products.reload();
                  }}
                />,
              ],
            }))}
          />
        )}
      </>
    );
  return (
    <>
      <RecordsFeedback error={products.error || fees.error} loading={products.records === null} />
      {products.records && (
        <WorkspaceTable
          label="products"
          columns={['Product', 'Venture', 'Listing', 'Evidence', 'Actions']}
          actions={role === 'entrepreneur' && <ProductEditor reload={products.reload} />}
          rows={products.records.map((product) => ({
            id: String(product.id),
            search: [
              product.name,
              product.venture,
              product.moderation,
              product.evidence_status,
            ].join(' '),
            cells: [
              <>
                <strong>{product.name}</strong>
                <p>{product.description}</p>
                <p>{formatKsh(product.price)}</p>
              </>,
              product.venture,
              <>
                {product.published ? 'Published' : 'Private'} · {product.moderation}
                {product.moderation_note && <p>{product.moderation_note}</p>}
                {product.payment_status && (
                  <p>
                    Payment {product.payment_status}
                    {product.payment_note ? ' · ' + product.payment_note : ''}
                  </p>
                )}
              </>,
              <>
                {product.evidence_status ?? '—'}
                {product.evidence && <p>{product.evidence}</p>}
                {product.evidence_note && <p>{product.evidence_note}</p>}
              </>,
              <div className="workspace-row-actions">
                {product.published && <Link to={'/marketplace/' + product.slug}>View</Link>}
                {role !== 'entrepreneur' && product.evidence_status === 'pending' && (
                  <DecisionAction
                    name={'Product evidence · ' + product.name}
                    decide={async (decision, note) => {
                      await laravelProgramme.reviewProduct(product.id, 'evidence', decision, note);
                      products.reload();
                    }}
                  />
                )}
                {role === 'entrepreneur' && (
                  <>
                    <ProductEditor product={product} reload={products.reload} />
                    {product.path_id &&
                      (product.graduated_at || product.included_path_id === product.path_id) &&
                      (!product.evidence_status || product.evidence_status === 'rejected') && (
                        <WorkspaceAction
                          action="Request product review"
                          title={product.name}
                          submit="Submit evidence"
                          save={async (data) => {
                            await laravelProgramme.submitProductEvidence(
                              product.id,
                              fieldValue(data, 'evidence'),
                            );
                            products.reload();
                          }}
                        >
                          <label>
                            Product evidence
                            <textarea name="evidence" required minLength={10} maxLength={5000} />
                          </label>
                        </WorkspaceAction>
                      )}
                    {listingFee &&
                      product.venture_status === 'approved' &&
                      product.moderation !== 'rejected' &&
                      (!product.payment_status || product.payment_status === 'declined') &&
                      !(product.graduated_at && product.evidence_status === 'approved') && (
                        <RecordProgrammePayment
                          purpose="marketplace"
                          id={product.id}
                          amount={listingFee.amount}
                          reload={products.reload}
                        />
                      )}
                  </>
                )}
              </div>,
            ],
          }))}
        />
      )}
    </>
  );
}

function ProductEditor({ product, reload }: { product?: Product; reload: () => void }) {
  return (
    <WorkspaceAction
      action={product ? 'Edit product' : 'Add product'}
      title={product?.name}
      create={!product}
      submit="Submit for review"
      save={async (data) => {
        await laravelProgramme.saveProduct(
          {
            name: fieldValue(data, 'name'),
            description: fieldValue(data, 'description'),
            price: fieldValue(data, 'price'),
            ...(product ? {} : { venture_id: Number(fieldValue(data, 'venture_id')) }),
          },
          product?.id,
        );
        reload();
      }}
    >
      {!product && <VenturePicker />}
      <label>
        Name
        <input name="name" required minLength={2} maxLength={120} defaultValue={product?.name} />
      </label>
      <label>
        Description
        <textarea
          name="description"
          required
          minLength={10}
          maxLength={5000}
          defaultValue={product?.description}
        />
      </label>
      <label>
        Price (KES)
        <input
          name="price"
          type="number"
          min={0}
          max={9999999999.99}
          step=".01"
          required
          defaultValue={product?.price}
        />
      </label>
    </WorkspaceAction>
  );
}

function VenturePicker() {
  const ventures = useWorkspaceRecords(laravelWorkspace.ventures);
  return (
    <>
      <RecordsFeedback error={ventures.error} loading={ventures.records === null} />
      <label>
        Venture
        <select name="venture_id" defaultValue="" required>
          <option value="" disabled>
            Select a venture
          </option>
          {ventures.records?.map((venture) => (
            <option key={venture.id} value={venture.id}>
              {venture.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

export function MarketplaceListings() {
  const [params, setParams] = useSearchParams();
  const { sidebar } = useCatalog();
  const category = params.get('category');
  const showListings = category !== null || params.has('q');
  const sectors = useWorkspaceRecords(marketplaceSectors, !showListings);
  const load = useCallback(
    (signal: AbortSignal) => publicMarketplace(signal, category),
    [category],
  );
  const result = useWorkspaceRecords(load, showListings);
  const query = params.get('q') ?? '';
  const matches = result.records?.filter(
    (product) =>
      (!category || product.sector.toLowerCase() === category.toLowerCase()) &&
      [product.name, product.venture, product.description]
        .join(' ')
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <>
      {!showListings && (
        <PageIntro
          eyebrow="Business directory"
          title="Built with purpose. Made in Kenya."
          description="Discover youth enterprises across industries and the people building them."
        />
      )}
      <section
        className={
          'container directory-section' +
          (sidebar.advertisements.length ? ' content-with-sidebar' : '')
        }
      >
        <div className="discovery-main">
          {showListings ? (
            <>
              <Link className="text-link marketplace-back" to="/marketplace">
                ← All sectors
              </Link>
              <h1 className="marketplace-sector-title">{category || 'Search marketplace'}</h1>
              <label className="search-input">
                <Search size={20} aria-hidden="true" />
                <span className="sr-only">Search marketplace listings</span>
                <input
                  type="search"
                  placeholder="Search marketplace listings"
                  value={query}
                  onChange={(event) =>
                    setParams(
                      (current) => {
                        const next = new URLSearchParams(current);
                        if (event.target.value) next.set('q', event.target.value);
                        else next.delete('q');
                        return next;
                      },
                      { replace: true },
                    )
                  }
                />
              </label>
              <RecordsFeedback error={result.error} loading={result.records === null} />
              {matches && (
                <>
                  <p className="result-count" role="status">
                    {matches.length} {matches.length === 1 ? 'listing' : 'listings'}
                  </p>
                  {matches.length ? (
                    <div className="content-grid">
                      {matches.map((product) => {
                        const path = '/marketplace/' + encodeURIComponent(product.slug);
                        return (
                          <article className="content-card" key={product.slug}>
                            <div className="card-copy">
                              <p className="eyebrow">{product.venture}</p>
                              <h3>
                                <Link to={path}>
                                  {product.name}
                                  <ArrowUpRight size={19} aria-hidden="true" />
                                </Link>
                              </h3>
                              <p>{product.description}</p>
                              <p>
                                <strong>{formatKsh(product.price)}</strong>
                              </p>
                              <Link className="card-read" to={path}>
                                Explore product <ArrowUpRight size={14} aria-hidden="true" />
                              </Link>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="empty-state">
                      {result.records?.length
                        ? query
                          ? 'No listings match this search.'
                          : 'No listings have been published in this category yet.'
                        : 'No listings have been published yet.'}
                    </p>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <RecordsFeedback error={sectors.error} loading={!sectors.records} />
              {sectors.records && <MarketplaceSectorGrid sectors={sectors.records} />}
            </>
          )}
        </div>
        {!!sidebar.advertisements.length && (
          <aside className="discovery-sidebar" aria-label="Marketplace sidebar">
            <AdvertisementsWidget />
          </aside>
        )}
      </section>
    </>
  );
}

function PublicProductDetails({ slug }: { slug: string }) {
  const load = useCallback((signal: AbortSignal) => publicProduct(slug, signal), [slug]);
  const result = useWorkspaceRecords(load);
  return (
    <>
      <PageIntro
        eyebrow="Business directory"
        title={result.records?.name ?? 'Marketplace product'}
        description=""
      />
      <section className="container section">
        <Link className="text-link marketplace-back" to="/marketplace">
          Back to marketplace
        </Link>
        <RecordsFeedback error={result.error} loading={result.records === null} />
        {result.records && (
          <div className="benefit-detail">
            <article className="benefit-prose">
              <h2>About this product</h2>
              <p className="workspace-detail-copy">{result.records.description}</p>
            </article>
            <aside className="profile-panel">
              <h2>Listing details</h2>
              <p>{result.records.venture}</p>
              <p>
                <strong>{formatKsh(result.records.price)}</strong>
              </p>
            </aside>
          </div>
        )}
      </section>
    </>
  );
}

export function MarketplaceProduct() {
  const { slug = '' } = useParams();
  return <PublicProductDetails key={slug} slug={slug} />;
}
