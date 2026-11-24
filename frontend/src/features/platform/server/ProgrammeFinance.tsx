import { useState } from 'react';
import {
  laravelProgramme,
  type FeePurpose,
  type PaymentInstructions,
} from '../../../services/laravel-programme-repository';
import { WorkspaceTable, WorkspaceTabs } from '../workspace/WorkspaceControls';
import { StatusIndicator } from '../../../shared/StatusIndicator';
import {
  fieldValue,
  RecordsFeedback,
  useWorkspaceRecords,
  WorkspaceAction,
} from './WorkspaceActions';

const feeLabels: Record<FeePurpose, string> = {
  'getting-started': 'Getting Started certificate',
  advanced: 'Intermediate / Advanced certificate',
  marketplace: 'Paid marketplace listing',
};

const kenyaShillings = new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' });

export function formatKsh(amount: string | number) {
  return kenyaShillings.format(Number(amount));
}

export function MpesaInstructionsBox({
  amount,
  instructions,
}: {
  amount: number;
  instructions?: PaymentInstructions | null;
}) {
  const loaded = useWorkspaceRecords(laravelProgramme.paymentInstructions, !instructions);
  const info = instructions ?? loaded.records;
  if (!info) return null;
  return (
    <div className="profile-panel" role="region" aria-label="Payment instructions">
      <p>
        <strong>{info.provider}</strong> · {info.recipient_name}
      </p>
      <p>
        Paybill / Till: <strong>{info.paybill_number}</strong> · Account:{' '}
        <strong>{info.account_number}</strong> · Amount: <strong>{formatKsh(amount)}</strong>
      </p>
      <p>{info.instructions}</p>
    </div>
  );
}

export function RecordProgrammePayment({
  purpose,
  id,
  amount,
  reload,
}: {
  purpose: FeePurpose;
  id: number;
  amount: number;
  reload: () => void;
}) {
  return (
    <WorkspaceAction
      action="Record payment"
      title={feeLabels[purpose]}
      submit="Submit payment proof"
      save={async (data) => {
        const file = data.get('receipt');
        await laravelProgramme.recordPayment(
          purpose,
          id,
          fieldValue(data, 'reference'),
          file instanceof File && file.size > 0 ? file : null,
        );
        reload();
      }}
    >
      <MpesaInstructionsBox amount={amount} />
      <label>
        M-Pesa confirmation code / payment reference
        <input
          name="reference"
          required
          minLength={3}
          maxLength={120}
          placeholder="e.g. SLK89XYZ12"
        />
      </label>
      <label>
        Payment receipt (optional · JPG, PNG, WebP or PDF, max 5 MB)
        <input
          name="receipt"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
        />
      </label>
    </WorkspaceAction>
  );
}

export function ProgrammePayments() {
  const settings = useWorkspaceRecords(laravelProgramme.fees);
  const instructions = useWorkspaceRecords(laravelProgramme.paymentInstructions);
  const payments = useWorkspaceRecords(laravelProgramme.payments);

  return (
    <WorkspaceTabs
      label="Payment management"
      views={[
        {
          id: 'instructions',
          label: 'M-Pesa payment instructions',
          content: (
            <>
              <RecordsFeedback error={instructions.error} loading={instructions.records === null} />
              {instructions.records && (
                <div className="profile-panel">
                  <p>
                    <strong>{instructions.records.provider}</strong> ·{' '}
                    {instructions.records.recipient_name}
                  </p>
                  <p>
                    Paybill / Till: <strong>{instructions.records.paybill_number}</strong> ·
                    Account: <strong>{instructions.records.account_number}</strong>
                  </p>
                  <p>{instructions.records.instructions}</p>
                  <WorkspaceAction
                    action="Edit payment instructions"
                    title="M-Pesa payment instructions"
                    submit="Save instructions"
                    save={async (data) => {
                      await laravelProgramme.updatePaymentInstructions({
                        provider: fieldValue(data, 'provider'),
                        paybill_number: fieldValue(data, 'paybill_number'),
                        account_number: fieldValue(data, 'account_number'),
                        recipient_name: fieldValue(data, 'recipient_name'),
                        instructions: fieldValue(data, 'instructions'),
                      });
                      instructions.reload();
                    }}
                  >
                    <label>
                      Payment channel
                      <input
                        name="provider"
                        required
                        minLength={2}
                        maxLength={80}
                        defaultValue={instructions.records.provider}
                      />
                    </label>
                    <label>
                      Paybill / Till number
                      <input
                        name="paybill_number"
                        required
                        minLength={2}
                        maxLength={60}
                        defaultValue={instructions.records.paybill_number}
                      />
                    </label>
                    <label>
                      Account reference format
                      <input
                        name="account_number"
                        required
                        minLength={2}
                        maxLength={80}
                        defaultValue={instructions.records.account_number}
                      />
                    </label>
                    <label>
                      Recipient / business name
                      <input
                        name="recipient_name"
                        required
                        minLength={2}
                        maxLength={140}
                        defaultValue={instructions.records.recipient_name}
                      />
                    </label>
                    <label>
                      Instructions shown to learners
                      <textarea
                        name="instructions"
                        required
                        minLength={10}
                        maxLength={1500}
                        rows={4}
                        defaultValue={instructions.records.instructions}
                      />
                    </label>
                  </WorkspaceAction>
                </div>
              )}
            </>
          ),
        },
        {
          id: 'fees',
          label: 'Fees',
          count: settings.records?.length,
          content: (
            <>
              <RecordsFeedback error={settings.error} loading={settings.records === null} />
              {settings.records && (
                <WorkspaceTable
                  label="fees"
                  columns={['Fee', 'Amount', 'Action']}
                  rows={settings.records.map((fee) => ({
                    id: fee.purpose,
                    search: feeLabels[fee.purpose],
                    cells: [
                      feeLabels[fee.purpose],
                      fee.enabled ? formatKsh(fee.amount) : <StatusIndicator status="disabled" />,
                      <WorkspaceAction
                        action="Edit pricing"
                        title={feeLabels[fee.purpose]}
                        save={async (data) => {
                          await laravelProgramme.updateFee(
                            fee.purpose,
                            Number(fieldValue(data, 'amount')),
                            data.get('enabled') === 'on',
                          );
                          settings.reload();
                        }}
                      >
                        <label>
                          Amount (KES)
                          <input
                            name="amount"
                            type="number"
                            required
                            min={0}
                            max={10000000}
                            defaultValue={fee.amount}
                          />
                        </label>
                        {fee.purpose === 'marketplace' && (
                          <label className="inline-checkbox">
                            <input type="checkbox" name="enabled" defaultChecked={fee.enabled} />{' '}
                            Enable paid listings
                          </label>
                        )}
                      </WorkspaceAction>,
                    ],
                  }))}
                />
              )}
            </>
          ),
        },
        {
          id: 'records',
          label: 'Payment records',
          count: payments.records?.length,
          content: (
            <>
              <RecordsFeedback error={payments.error} loading={payments.records === null} />
              {payments.records && (
                <WorkspaceTable
                  label="payments"
                  columns={[
                    'Account',
                    'Purpose',
                    'Amount',
                    'Reference & receipt',
                    'Status',
                    'Action',
                  ]}
                  rows={payments.records.map((payment) => ({
                    id: String(payment.id),
                    search: [
                      payment.payer,
                      payment.reference,
                      payment.status,
                      payment.venture,
                      payment.product,
                    ].join(' '),
                    cells: [
                      payment.payer,
                      <>
                        {feeLabels[payment.purpose]}
                        <p>{payment.product ?? payment.venture}</p>
                      </>,
                      formatKsh(payment.amount),
                      <>
                        <div>{payment.reference}</div>
                        {payment.has_receipt && (
                          <a
                            href={laravelProgramme.paymentReceiptUrl(payment.id)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View receipt
                          </a>
                        )}
                      </>,
                      <>
                        <StatusIndicator status={payment.status} />
                        {payment.decision_note && <p>{payment.decision_note}</p>}
                      </>,
                      payment.status === 'pending' ? (
                        <PaymentDecision id={payment.id} reload={payments.reload} />
                      ) : (
                        '—'
                      ),
                    ],
                  }))}
                />
              )}
            </>
          ),
        },
      ]}
    />
  );
}

function PaymentDecision({ id, reload }: { id: number; reload: () => void }) {
  const [decision, setDecision] = useState('confirmed');
  return (
    <WorkspaceAction
      action="Review payment"
      submit="Save decision"
      save={async (data) => {
        await laravelProgramme.reviewPayment(
          id,
          fieldValue(data, 'decision'),
          fieldValue(data, 'note'),
        );
        reload();
      }}
    >
      <label>
        Decision
        <select
          name="decision"
          value={decision}
          onChange={(event) => setDecision(event.target.value)}
        >
          <option value="confirmed">Confirm payment</option>
          <option value="declined">Decline payment</option>
        </select>
      </label>
      <label>
        {decision === 'declined' ? 'Reason for declining' : 'Note (optional)'}
        <textarea name="note" maxLength={1500} required={decision === 'declined'} />
      </label>
    </WorkspaceAction>
  );
}

export function VentureCertificates({ admin }: { admin: boolean }) {
  const { records, error, reload } = useWorkspaceRecords(laravelProgramme.certificates);
  return (
    <>
      <RecordsFeedback error={error} loading={records === null} />
      {records && (
        <WorkspaceTable
          label="venture certificates"
          columns={['Certificate', 'Recipient', 'Venture', 'Issuance', 'Action']}
          rows={records.map((certificate) => ({
            id: `${certificate.path_id}:${certificate.kind}`,
            search: [certificate.title, certificate.venture, certificate.recipient].join(' '),
            cells: [
              certificate.title,
              certificate.recipient,
              certificate.venture,
              certificate.document_id ? (
                'Issued'
              ) : certificate.eligible ? (
                'Ready for issuance'
              ) : certificate.payment_status === 'pending' ? (
                'Awaiting payment review'
              ) : (
                <>
                  {formatKsh(certificate.fee)} due
                  {certificate.payment_note && <p>{certificate.payment_note}</p>}
                </>
              ),
              certificate.document_id ? (
                <a
                  href={`/api/v1/workspace/venture-certificates/${certificate.document_id}/document`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View certificate
                </a>
              ) : admin && certificate.eligible ? (
                <WorkspaceAction
                  action="Issue certificate"
                  title={certificate.title}
                  submit="Issue certificate"
                  save={async () => {
                    await laravelProgramme.issueCertificate(certificate.path_id, certificate.kind);
                    reload();
                  }}
                >
                  <p>
                    {certificate.recipient} · {certificate.venture}
                  </p>
                </WorkspaceAction>
              ) : !admin &&
                !certificate.eligible &&
                certificate.payment_status !== 'pending' &&
                (certificate.kind === 'getting-started' || certificate.kind === 'advanced') ? (
                <RecordProgrammePayment
                  purpose={certificate.kind}
                  id={certificate.path_id}
                  amount={certificate.fee}
                  reload={reload}
                />
              ) : (
                '—'
              ),
            ],
          }))}
        />
      )}
    </>
  );
}
