import {
  WorkspaceDialog,
  WorkspaceStatus,
  WorkspaceTable,
  WorkspaceTabs,
} from '../workspace/WorkspaceControls';
import { feeLabels, feePurposes } from '../../../domain/incubation';
import type { PlatformState } from '../../../domain/platform';
import { amount, field, submitTraining, TrainingForm, type Save } from './TrainingForms';

export function TrainingPayments({
  p,
  save,
  name,
}: {
  p: PlatformState;
  save: Save;
  name: (id: string) => string;
}) {
  const payments = [...p.training.payments].reverse();
  const paymentRows = (entries: typeof payments) =>
    entries.map((payment) => {
      const item =
        payment.purpose === 'marketplace'
          ? p.products.find((product) => product.id === payment.targetId)?.name
          : p.ventures.find(
              (venture) =>
                venture.id ===
                p.incubations.find((path) => path.id === payment.targetId)?.ventureId,
            )?.name;
      return {
        id: payment.id,
        search: [item, feeLabels[payment.purpose], name(payment.accountId), payment.status].join(
          ' ',
        ),
        cells: [
          item ?? 'Payment',
          feeLabels[payment.purpose],
          name(payment.accountId),
          amount(payment.amount),
          <WorkspaceStatus>{payment.status}</WorkspaceStatus>,
          payment.status === 'pending' ? (
            <WorkspaceDialog action="Review payment" title={item ?? 'Review payment'}>
              {(finish) => (
                <>
                  <p>
                    {feeLabels[payment.purpose]} · {name(payment.accountId)} ·{' '}
                    {amount(payment.amount)}
                  </p>
                  <p>Confirm or decline this simulated payment.</p>
                  <div className="workspace-form-footer">
                    <button
                      className="button button-outline"
                      onClick={() =>
                        finish(
                          submitTraining(save, {
                            type: 'training-payment-review',
                            id: payment.id,
                            decision: 'declined',
                          }),
                        )
                      }
                    >
                      Decline payment
                    </button>
                    <button
                      className="button"
                      onClick={() =>
                        finish(
                          submitTraining(save, {
                            type: 'training-payment-review',
                            id: payment.id,
                            decision: 'confirmed',
                          }),
                        )
                      }
                    >
                      Confirm demo payment
                    </button>
                  </div>
                </>
              )}
            </WorkspaceDialog>
          ) : (
            '—'
          ),
        ],
      };
    });
  const pending = payments.filter((payment) => payment.status === 'pending');
  const columns = ['Item', 'Purpose', 'Member', 'Amount', 'Status', 'Action'];
  return (
    <WorkspaceTabs
      label="Payment views"
      views={[
        {
          id: 'pending',
          label: 'Awaiting confirmation',
          count: pending.length,
          content: (
            <WorkspaceTable
              label="pending payments"
              columns={columns}
              rows={paymentRows(pending)}
              empty="No payments are awaiting confirmation."
            />
          ),
        },
        {
          id: 'records',
          label: 'All payment records',
          count: payments.length,
          content: (
            <WorkspaceTable
              label="payment records"
              columns={columns}
              rows={paymentRows(payments)}
            />
          ),
        },
        {
          id: 'settings',
          label: 'Fee settings',
          content: (
            <WorkspaceTable
              label="fee settings"
              columns={['Purpose', 'Fee']}
              rows={feePurposes.map((purpose) => ({
                id: purpose,
                search: feeLabels[purpose],
                cells: [feeLabels[purpose], amount(p.training.fees[purpose])],
              }))}
              actions={
                <TrainingForm
                  save={save}
                  label="Save payment settings"
                  dialog={{ action: 'Edit payment settings' }}
                  build={(data) => ({
                    type: 'training-fees-save',
                    bypassEnabled: data.get('bypass') === 'on',
                    fees: {
                      'getting-started': Number(field(data, 'getting-started')),
                      advanced: Number(field(data, 'advanced')),
                      marketplace: Number(field(data, 'marketplace')),
                    },
                  })}
                >
                  {feePurposes.map((purpose) => (
                    <label key={purpose}>
                      {feeLabels[purpose]} (KES)
                      <input
                        name={purpose}
                        type="number"
                        min={purpose === 'marketplace' ? 1 : 0}
                        step="1"
                        required
                        defaultValue={p.training.fees[purpose]}
                      />
                    </label>
                  ))}
                  <label className="inline-checkbox">
                    <input
                      name="bypass"
                      type="checkbox"
                      defaultChecked={p.training.bypassEnabled}
                    />{' '}
                    Allow new paid listings without incubation
                  </label>
                </TrainingForm>
              }
            />
          ),
        },
      ]}
    />
  );
}
