import { Link } from 'react-router-dom';
import type { DemoAccount } from '../../domain/demo';
import {
  canPublishProduct,
  managesVenture,
  paymentFor,
  type TrainingState,
} from '../../domain/incubation';
import type { PlatformState, Product, Venture } from '../../domain/platform';
import { can } from '../../domain/roles';
import { workspaceHref } from '../dashboard/dashboard-navigation';
import { ProductPathways } from './IncubationWorkspace';
import { amount, field, type Save } from './TrainingForms';
import {
  WorkspaceDialog,
  WorkspaceFormDialog,
  WorkspaceStatus,
  WorkspaceTable,
} from './WorkspaceControls';

type Props = { p: PlatformState; account: DemoAccount; save: Save };

export function VentureRegistry({ p, account, save }: Props) {
  const ventures = p.ventures.filter((venture) => managesVenture(p, account, venture));
  const school = p.training.institutions.find((entry) => entry.adminId === account.id);
  const teams = p.training.groups.filter((group) => group.institutionId === school?.id);
  const needsTeam = can(account, 'school') && !teams.length;
  return (
    <WorkspaceTable
      label="ventures"
      columns={['Venture', 'Sector', 'Stage', 'Location', 'Status', 'Action']}
      empty={
        needsTeam ? (
          <>
            Create a team in the{' '}
            <Link to={workspaceHref('school') + '&view=teams'}>institution portal</Link> to add its
            first venture.
          </>
        ) : (
          'Add your first venture to start incubation or submit a product.'
        )
      }
      actions={!needsTeam && <VentureEditor account={account} teams={teams} save={save} />}
      rows={ventures.map((venture) => ({
        id: venture.id,
        search: [
          venture.name,
          venture.sector,
          venture.stage,
          venture.location,
          venture.status,
        ].join(' '),
        cells: [
          venture.name,
          venture.sector,
          venture.stage,
          venture.location,
          <WorkspaceStatus>{venture.status}</WorkspaceStatus>,
          <VentureEditor venture={venture} account={account} teams={teams} save={save} />,
        ],
      }))}
    />
  );
}

function VentureEditor({
  venture,
  teams,
  account,
  save,
}: {
  venture?: Venture;
  teams: TrainingState['groups'];
  account: DemoAccount;
  save: Save;
}) {
  return (
    <WorkspaceFormDialog
      action={venture ? 'Edit venture' : 'Add venture'}
      title={venture ? venture.name : 'Add venture'}
      create={!venture}
      submit={venture ? 'Resubmit venture' : 'Submit venture for approval'}
      onSave={(data) =>
        save({
          type: 'venture-save',
          now: new Date().toISOString(),
          venture: {
            id: venture?.id ?? crypto.randomUUID(),
            ownerId: account.id,
            groupId: venture?.groupId ?? (field(data, 'group') || undefined),
            name: field(data, 'name'),
            description: field(data, 'description'),
            sector: field(data, 'sector'),
            stage: field(data, 'stage'),
            location: field(data, 'location'),
            status: venture?.status ?? 'pending',
          },
        })
      }
    >
      {venture && <p>Changes require a new approval.</p>}
      {!venture && teams.length > 0 && (
        <label>
          Venture team
          <select name="group" required>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Venture name
        <input name="name" required minLength={3} defaultValue={venture?.name} />
      </label>
      <label>
        What problem do you solve?
        <textarea
          name="description"
          required
          minLength={30}
          maxLength={3000}
          defaultValue={venture?.description}
        />
      </label>
      <div className="form-field-grid">
        <label>
          Sector
          <input name="sector" required minLength={2} defaultValue={venture?.sector} />
        </label>
        <label>
          Stage
          <input name="stage" required minLength={2} defaultValue={venture?.stage} />
        </label>
        <label>
          Location
          <input name="location" required minLength={2} defaultValue={venture?.location} />
        </label>
      </div>
    </WorkspaceFormDialog>
  );
}

export function ProductRegistry({ p, account, save }: Props) {
  const ventures = p.ventures.filter((venture) => managesVenture(p, account, venture));
  const products = p.products.filter((product) =>
    ventures.some((venture) => venture.id === product.ventureId),
  );
  return (
    <WorkspaceTable
      label="products"
      columns={['Product', 'Venture', 'Price', 'Moderation', 'Marketplace', 'Actions']}
      empty={
        ventures.length ? (
          'Add a product to submit it for listing approval.'
        ) : (
          <>
            Create a <Link to={workspaceHref('ventures')}>venture</Link> before adding products.
          </>
        )
      }
      actions={
        ventures.length > 0 && <ProductEditor ventures={ventures} account={account} save={save} />
      }
      rows={products.map((product) => {
        const venture = ventures.find((item) => item.id === product.ventureId);
        const live = canPublishProduct(p, product);
        const payment = paymentFor(p.training, 'marketplace', product.id);
        const queue =
          product.status === 'pending'
            ? 'approvals'
            : payment?.status === 'pending'
              ? 'payments'
              : null;
        return {
          id: product.id,
          search: [product.name, venture?.name, product.status, live ? 'live' : 'private'].join(
            ' ',
          ),
          cells: [
            product.name,
            venture?.name,
            amount(product.price),
            <WorkspaceStatus>{product.status}</WorkspaceStatus>,
            live ? (
              <Link to={`/marketplace/product-${product.id}`}>View public listing</Link>
            ) : (
              <WorkspaceStatus>Private</WorkspaceStatus>
            ),
            <div className="workspace-row-actions">
              <WorkspaceDialog action="Listing details" title={product.name}>
                {() => (
                  <>
                    <p className="workspace-detail-copy">{product.description}</p>
                    <ProductPathways p={p} product={product} save={save} />
                  </>
                )}
              </WorkspaceDialog>
              <ProductEditor product={product} ventures={ventures} account={account} save={save} />
              {queue && (
                <Link
                  className="text-link"
                  to={`/demo?${new URLSearchParams({ redirect: workspaceHref(queue) })}`}
                >
                  Switch demo role to review
                </Link>
              )}
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
      submit={product ? 'Resubmit product' : 'Submit product for approval'}
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
