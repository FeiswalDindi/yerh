import { useState } from 'react';
import { laravelProgramme, type FeePurpose } from '../../../services/laravel-programme-repository';
import { WorkspaceTable } from '../workspace/WorkspaceControls';
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
      submit="Submit reference"
      save={async (data) => {
        await laravelProgramme.recordPayment(purpose, id, fieldValue(data, 'reference'));
        reload();
      }}
    >
      <p>{formatKsh(amount)}. Enter the reference from the payment already made.</p>
      <label>
        Payment reference
        <input name="reference" required minLength={3} maxLength={120} />
      </label>
    </WorkspaceAction>
  );
}

export function ProgrammePayments() {
  const settings = useWorkspaceRecords(laravelProgramme.fees);
  const payments = useWorkspaceRecords(laravelProgramme.payments);

  return (
    <>
      <h2>Fees</h2>
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
              fee.enabled ? formatKsh(fee.amount) : 'Disabled',
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
                    <input type="checkbox" name="enabled" defaultChecked={fee.enabled} /> Enable
                    paid listings
                  </label>
                )}
              </WorkspaceAction>,
            ],
          }))}
        />
      )}
      <h2>Payment records</h2>
      <RecordsFeedback error={payments.error} loading={payments.records === null} />
      {payments.records && (
        <WorkspaceTable
          label="payments"
          columns={['Account', 'Purpose', 'Amount', 'Reference', 'Status', 'Action']}
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
              payment.reference,
              <>
                {payment.status}
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
