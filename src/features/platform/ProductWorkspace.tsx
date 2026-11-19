import { Link, useSearchParams } from 'react-router-dom';
import type { DemoAccount } from '../../domain/demo';
import { managesVenture, paymentFor } from '../../domain/incubation';
import type { Product, Venture } from '../../domain/platform';
import { can } from '../../domain/roles';
import { workspaceHref } from '../dashboard/dashboard-navigation';
import { ProductPathways } from './IncubationWorkspace';
import { amount, field, type Save } from './TrainingForms';
import { WorkspaceFormDialog, WorkspaceTable } from './WorkspaceControls';
import type { VentureWorkspaceProps } from './VentureWorkspace';

export default function ProductRegistry({
  p,
  account,
  save,
  portalHref = workspaceHref,
}: VentureWorkspaceProps) {
  const ventures = p.ventures.filter((venture) => managesVenture(p, account, venture));
  const products = p.products.filter((product) =>
    ventures.some((venture) => venture.id === product.ventureId),
  );
  const school = can(account, 'school');
  const [params] = useSearchParams();
  const selected = products.find((product) => product.id === params.get('product'));
  if (selected) {
    const venture = ventures.find((item) => item.id === selected.ventureId);
    const payment = paymentFor(p.training, 'marketplace', selected.id);
    const queue =
      selected.status === 'pending'
        ? 'approvals'
        : payment?.status === 'pending'
          ? 'payments'
          : null;
    return (
      <section className="workspace-record">
        <Link to={portalHref('products')}>← All products</Link>
        <h3>{selected.name}</h3>
        <p>
          {venture?.name} · {amount(selected.price)}
        </p>
        <p className="workspace-detail-copy">{selected.description}</p>
        <ProductEditor product={selected} ventures={ventures} account={account} save={save} />
        {!school && !venture?.groupId && (
          <>
            <ProductPathways p={p} product={selected} save={save} />
            {queue && (
              <Link
                className="text-link"
                to={'/demo?' + new URLSearchParams({ redirect: workspaceHref(queue) }).toString()}
              >
                Switch demo role to review
              </Link>
            )}
          </>
        )}
      </section>
    );
  }
  return (
    <WorkspaceTable
      label="products"
      columns={['Product', 'Venture', 'Price', 'Actions']}
      empty={
        ventures.length ? (
          'Add a product or service to a venture.'
        ) : (
          <>
            Create a <Link to={portalHref('ventures')}>venture</Link> before adding products.
          </>
        )
      }
      actions={
        ventures.length > 0 && <ProductEditor ventures={ventures} account={account} save={save} />
      }
      rows={products.map((product) => {
        const venture = ventures.find((item) => item.id === product.ventureId);
        return {
          id: product.id,
          search: [product.name, venture?.name].join(' '),
          cells: [
            product.name,
            venture?.name,
            amount(product.price),
            <div className="workspace-row-actions">
              <Link
                to={portalHref('products') + '&product=' + encodeURIComponent(product.id)}
                aria-label="View product"
              >
                View
              </Link>
            </div>,
          ],
        };
      })}
    />
  );
}

function ProductEditor({
  product,
  ventures,
  account,
  save,
}: {
  product?: Product;
  ventures: Venture[];
  account: DemoAccount;
  save: Save;
}) {
  return (
    <WorkspaceFormDialog
      action={product ? 'Edit product' : 'Add product'}
      title={product ? product.name : 'Add product or service'}
      create={!product}
      submit={
        can(account, 'school')
          ? 'Save product'
          : product
            ? 'Resubmit product'
            : 'Submit product for approval'
      }
      onSave={(data) =>
        save({
          type: 'product-save',
          now: new Date().toISOString(),
          product: {
            id: product?.id ?? crypto.randomUUID(),
            ownerId: product?.ownerId ?? account.id,
            ventureId: product?.ventureId ?? field(data, 'ventureId'),
            name: field(data, 'name'),
            description: field(data, 'description'),
            price: Number(field(data, 'price')),
            status: product?.status ?? 'pending',
          },
        })
      }
    >
      {!product && (
        <label>
          Venture
          <select name="ventureId" required>
            {ventures.map((venture) => (
              <option key={venture.id} value={venture.id}>
                {venture.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Product / service name
        <input name="name" required minLength={3} defaultValue={product?.name} />
      </label>
      <label>
        Description
        <textarea
          name="description"
          required
          minLength={20}
          maxLength={3000}
          defaultValue={product?.description}
        />
      </label>
      <label>
        Price (KES)
        <input name="price" type="number" min={0} required defaultValue={product?.price} />
      </label>
    </WorkspaceFormDialog>
  );
}
