import { marketplaceSectors } from '../../../services/laravel-marketplace-sectors';
import { useCatalog } from '../../../app/useCatalog';
import { AdvertisementsWidget } from '../../discovery/AdvertisementsWidget';
import { MarketplaceSectorGrid } from '../../content/MarketplaceSectorGrid';
import { RegistryReview } from './RegistryReview';
import { useCallback } from 'react';
import { ArrowUpRight, Mail, MessageCircle, Phone, Search } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { PageIntro } from '../../../shared/PageIntro';
import { SmartImage } from '../../../shared/SmartImage';
import { StatusIndicator } from '../../../shared/StatusIndicator';
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

function whatsappHref(raw: string, productName: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  const intl = digits.startsWith('0') && digits.length === 10 ? '254' + digits.slice(1) : digits;
  const text = `Hello, I am interested in "${productName}" listed on the Youth Entrepreneurship Resource Hub marketplace.`;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

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
                <div className="workspace-product-cell">
                  {p.image_url && (
                    <SmartImage
                      className="workspace-product-thumb"
                      src={p.image_url}
                      alt=""
                      targetWidth={320}
                    />
                  )}
                  <span>{p.name}</span>
                </div>,
                p.owner,
                <StatusIndicator status={p.moderation} />,
                p.published ? (
                  <Link to={'/marketplace/' + p.slug}>
                    <StatusIndicator status="published" label="Live" />
                  </Link>
                ) : (
                  <StatusIndicator status="private" label="Private" />
                ),
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
              <div className="workspace-product-cell">
                {product.image_url && (
                  <SmartImage
                    className="workspace-product-thumb"
                    src={product.image_url}
                    alt=""
                    targetWidth={320}
                  />
                )}
                <div>
                  <strong>{product.name}</strong>
                  <p>{product.description}</p>
                  <p>{formatKsh(product.price)}</p>
                </div>
              </div>,
              product.venture,
              <>
                <span className="status-indicator-group">
                  <StatusIndicator status={product.published ? 'published' : 'private'} />
                  <StatusIndicator status={product.moderation} />
                </span>
                {product.moderation_note && <p>{product.moderation_note}</p>}
                {product.payment_status && (
                  <p>
                    <StatusIndicator
                      status={product.payment_status}
                      label={`Payment ${product.payment_status}`}
                    />
                    {product.payment_note ? ' · ' + product.payment_note : ''}
                  </p>
                )}
              </>,
              <>
                {product.evidence_status ? (
                  <StatusIndicator status={product.evidence_status} />
                ) : (
                  '—'
                )}
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
        const photoEntry = data.get('photo');
        const photo = photoEntry instanceof File && photoEntry.size > 0 ? photoEntry : null;
        const removePhoto = data.get('remove_photo') === 'on';
        await laravelProgramme.saveProduct(
          {
            name: fieldValue(data, 'name'),
            description: fieldValue(data, 'description'),
            price: fieldValue(data, 'price'),
            contact_email: fieldValue(data, 'contact_email'),
            contact_phone: fieldValue(data, 'contact_phone'),
            whatsapp: fieldValue(data, 'whatsapp'),
            photo,
            remove_photo: removePhoto,
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
      {product?.image_url && (
        <div className="workspace-product-preview">
          <SmartImage src={product.image_url} alt={product.name} targetWidth={320} />
          <label className="inline-checkbox">
            <input type="checkbox" name="remove_photo" /> Remove current photo
          </label>
        </div>
      )}
      <label>
        Product photo (optional: JPG, PNG, WebP, max 4 MB)
        <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
      </label>
      <div className="workspace-form-grid">
        <label>
          WhatsApp inquiry number (optional)
          <input
            name="whatsapp"
            maxLength={40}
            defaultValue={product?.whatsapp ?? ''}
            placeholder="e.g. +254700000000"
          />
        </label>
        <label>
          Contact phone (optional)
          <input
            name="contact_phone"
            maxLength={40}
            defaultValue={product?.contact_phone ?? ''}
            placeholder="e.g. +254700000000"
          />
        </label>
      </div>
      <label>
        Inquiry email (optional — defaults to your account email)
        <input
          name="contact_email"
          type="email"
          maxLength={254}
          defaultValue={product?.contact_email ?? ''}
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
                            {product.image_url && (
                              <div className="card-media">
                                <Link to={path} tabIndex={-1} aria-hidden="true">
                                  <SmartImage
                                    src={product.image_url}
                                    alt={product.name}
                                    targetWidth={640}
                                    sizes="(max-width: 900px) 100vw, 400px"
                                  />
                                </Link>
                                <span className="image-tag">{product.sector}</span>
                              </div>
                            )}
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
  const item = result.records;
  const waLink = item?.whatsapp ? whatsappHref(item.whatsapp, item.name) : null;
  return (
    <>
      <PageIntro
        eyebrow="Business directory"
        title={item?.name ?? 'Marketplace product'}
        description=""
      />
      <section className="container section">
        <Link className="text-link marketplace-back" to="/marketplace">
          Back to marketplace
        </Link>
        <RecordsFeedback error={result.error} loading={item === null} />
        {item && (
          <div className="benefit-detail">
            <article className="benefit-prose">
              {item.image_url && (
                <SmartImage
                  className="marketplace-product-photo"
                  src={item.image_url}
                  alt={item.name}
                  priority
                  targetWidth={1000}
                  sizes="(max-width: 900px) 100vw, 760px"
                />
              )}
              <h2>About this product</h2>
              <p className="workspace-detail-copy">{item.description}</p>
            </article>
            <aside className="profile-panel marketplace-inquiry-panel">
              <h2>Listing details</h2>
              <p>
                <strong>{formatKsh(item.price)}</strong>
              </p>
              <p>{item.venture}</p>
              <p>{item.sector}</p>
              {(item.location || item.institution) && (
                <p>{[item.location, item.institution].filter(Boolean).join(' · ')}</p>
              )}
              {item.seller_name && <p>Listed by {item.seller_name}</p>}
              <div className="marketplace-inquiry-actions">
                {waLink && (
                  <a className="button" href={waLink} target="_blank" rel="noreferrer">
                    <MessageCircle size={17} aria-hidden="true" /> Inquire on WhatsApp
                  </a>
                )}
                {item.seller_email && (
                  <a
                    className={waLink ? 'button button-outline' : 'button'}
                    href={`mailto:${item.seller_email}?subject=${encodeURIComponent('Product inquiry: ' + item.name)}`}
                  >
                    <Mail size={17} aria-hidden="true" /> Email seller
                  </a>
                )}
                {item.seller_phone && (
                  <a className="text-link" href={`tel:${item.seller_phone}`}>
                    <Phone size={15} aria-hidden="true" /> Call {item.seller_phone}
                  </a>
                )}
                {!waLink && !item.seller_email && !item.seller_phone && (
                  <Link className="button button-outline" to="/contact?topic=Partnership">
                    Contact hub team to inquire <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                )}
              </div>
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
