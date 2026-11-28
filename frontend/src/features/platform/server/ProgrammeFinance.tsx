import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { ReceiptPreviewModal } from './ReceiptPreviewModal';
import { learningRepository } from '../../../services/laravel-learning-repository';
import {
  laravelProgramme,
  type FeePurpose,
  type PaymentInstructions,
} from '../../../services/laravel-programme-repository';
import { WorkspaceTable, WorkspaceTabs } from '../workspace/WorkspaceControls';
import { StatusIndicator } from '../../../shared/StatusIndicator';
import { CourseEnrolmentRegistry } from './CourseAdministration';
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

async function copyText(value: string): Promise<boolean> {
  if (!value) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fallback below when Clipboard API is blocked or unavailable
  }
  if (typeof document === 'undefined') return false;
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  document.body.removeChild(textarea);
  return copied;
}

function CopyablePaymentDetail({
  label,
  displayValue,
  copyValue,
}: {
  label: string;
  displayValue: string;
  copyValue?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);
  const target = (copyValue ?? displayValue).trim();

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  async function handleCopy() {
    if (!(await copyText(target))) return;
    setCopied(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      className={`mpesa-copy-tile${copied ? ' is-copied' : ''}`}
      onClick={() => void handleCopy()}
      aria-label={`Copy ${label}: ${target}`}
      title={`Click to copy ${label}`}
    >
      <span className="mpesa-tile-top">
        <span>{label}</span>
        <span className="mpesa-copy-chip" aria-live="polite">
          {copied ? (
            <>
              <Check size={12} aria-hidden="true" /> Copied
            </>
          ) : (
            <>
              <Copy size={12} aria-hidden="true" /> Copy
            </>
          )}
        </span>
      </span>
      <strong>{displayValue}</strong>
    </button>
  );
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
  if (!info) {
    return (
      <div className="profile-panel" role="region" aria-label="Payment instructions">
        <RecordsFeedback loading={loaded.records === null} error={loaded.error} />
      </div>
    );
  }
  return (
    <div className="profile-panel" role="region" aria-label="Payment instructions">
      <div className="mpesa-details-grid">
        <div>
          <span>Payment channel</span>
          <strong>{info.provider}</strong>
        </div>
        <CopyablePaymentDetail label="Paybill / Till number" displayValue={info.paybill_number} />
        <CopyablePaymentDetail label="Account number" displayValue={info.account_number} />
        <CopyablePaymentDetail label="Recipient" displayValue={info.recipient_name} />
        <CopyablePaymentDetail
          label="Amount due"
          displayValue={formatKsh(amount)}
          copyValue={String(amount)}
        />
      </div>
      <p className="mpesa-instructions-copy">{info.instructions}</p>
      {info.refund_notice && (
        <div className="mpesa-refund-notice" role="note">
          <strong>24-Hour Approval &amp; Refund Guarantee</strong>
          <p>{info.refund_notice}</p>
        </div>
      )}
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
        Payment receipt screenshot or PDF (required · JPG, PNG, WebP or PDF, max 5 MB)
        <input
          name="receipt"
          type="file"
          required
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
  const courseEnrolments = useWorkspaceRecords(learningRepository.registry);
  const pendingCourseCount = courseEnrolments.records?.filter(
    (entry) => entry.payment_status === 'pending',
  ).length;

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
                  <div className="mpesa-details-grid">
                    <div>
                      <span>Payment channel</span>
                      <strong>{instructions.records.provider}</strong>
                    </div>
                    <CopyablePaymentDetail
                      label="Paybill / Till number"
                      displayValue={instructions.records.paybill_number}
                    />
                    <CopyablePaymentDetail
                      label="Account number"
                      displayValue={instructions.records.account_number}
                    />
                    <CopyablePaymentDetail
                      label="Recipient"
                      displayValue={instructions.records.recipient_name}
                    />
                  </div>
                  <p className="mpesa-instructions-copy">{instructions.records.instructions}</p>
                  {instructions.records.refund_notice && (
                    <div className="mpesa-refund-notice" role="note">
                      <strong>24-Hour Approval &amp; Refund Guarantee Notice</strong>
                      <p>{instructions.records.refund_notice}</p>
                    </div>
                  )}
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
                        refund_notice: fieldValue(data, 'refund_notice'),
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
                      Account number
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
                    <label>
                      Approval &amp; refund guarantee notice
                      <textarea
                        name="refund_notice"
                        required
                        minLength={10}
                        maxLength={1000}
                        rows={3}
                        defaultValue={instructions.records.refund_notice}
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
                          <ReceiptPreviewModal
                            url={laravelProgramme.paymentReceiptUrl(payment.id)}
                            title={`${payment.payer} · ${feeLabels[payment.purpose]}`}
                            reference={payment.reference}
                          />
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
        {
          id: 'course-payments',
          label: 'Course payments',
          count: pendingCourseCount,
          content: <CourseEnrolmentRegistry />,
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
