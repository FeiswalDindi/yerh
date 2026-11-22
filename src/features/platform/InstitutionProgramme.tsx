import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { DemoAccount } from '../../domain/demo';
import type { Institution } from '../../domain/incubation';
import {
  institutionProgramme,
  programmePaymentLabels,
  type ProgrammeMember,
  type ProgrammeVenture,
} from '../../domain/institution-programme';
import type { PlatformState } from '../../domain/platform';
import { amount } from './TrainingForms';
import { WorkspaceTable } from './WorkspaceControls';

export type ProgrammeTab = 'progress' | 'programme-payments';
type TabParameter = 'view' | 'area';

export function programmeHref(
  params: URLSearchParams,
  tabParameter: TabParameter,
  tab: ProgrammeTab,
  member?: string,
  venture?: string,
) {
  const next = new URLSearchParams(params);
  next.set(tabParameter, tab);
  next.delete('member');
  next.delete('venture');
  if (member) next.set('member', member);
  if (venture) next.set('venture', venture);
  return '?' + next.toString();
}

type ReportLink = (tab: ProgrammeTab, member?: string, venture?: string) => string;

const dateFormat = new Intl.DateTimeFormat('en-KE', {
  dateStyle: 'medium',
  timeZone: 'Africa/Nairobi',
});
const formatDate = (date?: string) => (date ? dateFormat.format(new Date(date)) : '—');

function ReportFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="workspace-toolbar-filter">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">All</option>
        {[...new Set(options)]
          .sort((a, b) => a.localeCompare(b))
          .map((option) => (
            <option key={option}>{option}</option>
          ))}
      </select>
    </label>
  );
}

function VentureProgressTable({
  members,
  href,
  exportName,
  filterable = false,
}: {
  members: ProgrammeMember[];
  href: ReportLink;
  exportName: string;
  filterable?: boolean;
}) {
  const [stage, setStage] = useState('');
  const [mentor, setMentor] = useState('');
  const [action, setAction] = useState('');
  const rows = members.flatMap((member) => {
    const ventures: (ProgrammeVenture | undefined)[] = member.ventures.length
      ? member.ventures
      : [undefined];
    return ventures.map((venture) => ({
      member,
      venture,
      stage:
        venture?.stage?.title ??
        (venture?.assessments === 3 ? 'All stages assessed' : 'Not started'),
      mentor: venture?.mentor || 'Unassigned',
      action: venture?.action ?? 'Create a venture',
    }));
  });
  return (
    <WorkspaceTable
      label="member progress"
      columns={['Member', 'Venture', 'Current stage', 'Mentor', 'Next action', 'Last activity']}
      exportName={exportName}
      empty={
        rows.length
          ? 'No records match the selected filters.'
          : 'Member progress appears after a learner accepts an invitation or YERH approves their application.'
      }
      actions={
        filterable && (
          <>
            <ReportFilter
              label="Stage"
              value={stage}
              onChange={setStage}
              options={rows.map((row) => row.stage)}
            />
            <ReportFilter
              label="Mentor"
              value={mentor}
              onChange={setMentor}
              options={rows.map((row) => row.mentor)}
            />
            <ReportFilter
              label="Next action"
              value={action}
              onChange={setAction}
              options={rows.map((row) => row.action)}
            />
          </>
        )
      }
      rows={rows
        .filter(
          (row) =>
            (!stage || row.stage === stage) &&
            (!mentor || row.mentor === mentor) &&
            (!action || row.action === action),
        )
        .map(({ member, venture, stage, mentor, action }) => {
          const name = venture?.name ?? 'No venture yet';
          const activity = venture?.activity[0];
          const lastActivity = formatDate(activity?.at);
          return {
            id: venture?.id ?? `member:${member.id}`,
            search: [member.name, member.email, name, stage, mentor, action].join(' '),
            cells: [
              <Link to={href('progress', member.id)}>{member.name}</Link>,
              venture ? <Link to={href('progress', member.id, venture.id)}>{name}</Link> : name,
              stage,
              mentor,
              action,
              activity ? (
                <>
                  <time dateTime={activity.at}>{lastActivity}</time>
                  <br />
                  {activity.title}
                </>
              ) : (
                lastActivity
              ),
            ],
            csv: [
              member.name,
              name,
              stage,
              mentor,
              action,
              activity ? `${lastActivity} · ${activity.title}` : '',
            ],
          };
        })}
    />
  );
}

function VentureProgressDetail({ venture }: { venture: ProgrammeVenture }) {
  return (
    <>
      <h3>{venture.name}</h3>
      <dl className="workspace-profile">
        <div>
          <dt>Mentor</dt>
          <dd>{venture.mentor || 'Unassigned'}</dd>
        </div>
        <div>
          <dt>Next action</dt>
          <dd>{venture.action}</dd>
        </div>
        <div>
          <dt>Assessments recorded</dt>
          <dd>
            {venture.assessments} of {venture.stages.length}
          </dd>
        </div>
      </dl>
      <WorkspaceTable
        label="pathway stages"
        columns={['Stage', 'Evidence saved', 'Progress']}
        rows={venture.stages.map((stage) => ({
          id: stage.id,
          search: stage.title + ' ' + stage.action,
          cells: [stage.title, stage.evidence, stage.action],
        }))}
      />
      <h4>Pathway activity</h4>
      <WorkspaceTable
        label="pathway activity"
        columns={['Date', 'Milestone', 'Stage']}
        empty="No pathway activity has been recorded yet."
        rows={venture.activity.map((entry) => ({
          id: entry.id,
          search: [entry.title, entry.stage].join(' '),
          cells: [
            <time dateTime={entry.at}>{formatDate(entry.at)}</time>,
            entry.title,
            entry.stage ?? '—',
          ],
        }))}
      />
    </>
  );
}

function ProgrammePayments({
  members,
  ventureId,
  href,
  exportName,
}: {
  members: ProgrammeMember[];
  ventureId?: string;
  href: ReportLink;
  exportName: string;
}) {
  const [paymentFilter, setPaymentFilter] = useState('');
  const [certificateFilter, setCertificateFilter] = useState('');
  const rows = members.flatMap((member) =>
    member.ventures
      .filter((venture) => !ventureId || venture.id === ventureId)
      .flatMap((venture) =>
        venture.certificates.map((certificate) => {
          const payment = programmePaymentLabels[certificate.payment];
          const paidOrFree = certificate.payment === 'free' || certificate.payment === 'confirmed';
          return {
            id: JSON.stringify([venture.id, certificate.kind]),
            member,
            venture,
            certificate,
            payment,
            issuance: certificate.issuedAt
              ? 'Issued'
              : paidOrFree
                ? 'Awaiting issuance'
                : 'Awaiting payment',
          };
        }),
      ),
  );
  return (
    <WorkspaceTable
      label="programme payments and certificates"
      columns={['Member', 'Venture', 'Certificate', 'Fee', 'Payment', 'Issuance', 'Issued on']}
      exportName={exportName}
      empty={
        rows.length
          ? 'No records match the selected filters.'
          : 'Certificate fees appear here after the required assessments are recorded.'
      }
      actions={
        <>
          <ReportFilter
            label="Payment"
            value={paymentFilter}
            onChange={setPaymentFilter}
            options={Object.values(programmePaymentLabels)}
          />
          <ReportFilter
            label="Issuance"
            value={certificateFilter}
            onChange={setCertificateFilter}
            options={['Issued', 'Awaiting issuance', 'Awaiting payment']}
          />
        </>
      }
      rows={rows
        .filter(
          (row) =>
            (!paymentFilter || row.payment === paymentFilter) &&
            (!certificateFilter || row.issuance === certificateFilter),
        )
        .map(({ id, member, venture, certificate, payment, issuance }) => ({
          id,
          search: [
            member.name,
            member.email,
            venture.name,
            certificate.title,
            payment,
            issuance,
          ].join(' '),
          cells: [
            <Link to={href('progress', member.id)}>{member.name}</Link>,
            <Link to={href('progress', member.id, venture.id)}>{venture.name}</Link>,
            certificate.title,
            amount(certificate.amount),
            payment,
            issuance,
            formatDate(certificate.issuedAt),
          ],
          csv: [
            member.name,
            venture.name,
            certificate.title,
            certificate.amount,
            payment,
            issuance,
            formatDate(certificate.issuedAt),
          ],
        }))}
    />
  );
}

export function InstitutionProgramme({
  p,
  institution,
  accounts,
  operator,
  tab,
  tabParameter = 'view',
}: {
  p: PlatformState;
  institution: Institution;
  accounts: DemoAccount[];
  operator: DemoAccount;
  tab: ProgrammeTab;
  tabParameter?: TabParameter;
}) {
  const [params] = useSearchParams();
  const report = institutionProgramme(p, accounts, institution.id, operator);
  if (!report || (tab === 'programme-payments' && !report.canViewPayments))
    return <p>This report is available to authorized staff of an active university or hub.</p>;

  const href: ReportLink = (page, member, venture) =>
    programmeHref(params, tabParameter, page, member, venture);
  const memberId = params.get('member');
  const ventureId = params.get('venture');
  const member = report.members.find(({ id }) => id === memberId);
  const venture = member?.ventures.find(({ id }) => id === ventureId);
  if ((memberId && !member) || (ventureId && !venture))
    return (
      <p>
        This record is unavailable.{' '}
        <Link className="text-link" to={href(tab)}>
          Return to the report
        </Link>
        .
      </p>
    );
  if (tab === 'programme-payments')
    return (
      <>
        {member && (
          <Link className="text-link" to={href(tab)}>
            ← All payments &amp; certificates
          </Link>
        )}
        {member && <h3>{venture ? `${member.name} · ${venture.name}` : member.name}</h3>}
        <ProgrammePayments
          key={JSON.stringify([institution.id, memberId, ventureId])}
          members={member ? [member] : report.members}
          ventureId={venture?.id}
          href={href}
          exportName="yerh-programme-payments.csv"
        />
      </>
    );
  if (member)
    return (
      <>
        <div className="workspace-toolbar-actions">
          <Link className="text-link" to={href('progress', venture ? member.id : undefined)}>
            {venture ? '← All member ventures' : '← All members'}
          </Link>
          {report.canViewPayments && (
            <Link className="text-link" to={href('programme-payments', member.id, venture?.id)}>
              Payments &amp; Certificates
            </Link>
          )}
        </div>
        <h3>{member.name}</h3>
        {venture ? (
          <VentureProgressDetail key={venture.id} venture={venture} />
        ) : (
          <VentureProgressTable
            key={member.id}
            members={[member]}
            href={href}
            exportName="yerh-member-progress.csv"
          />
        )}
      </>
    );
  const ventures = report.members.flatMap((row) => row.ventures);
  return (
    <>
      <div className="cohort-metrics" aria-label="Programme activity">
        <div>
          <strong>{report.members.length}</strong>
          <span>Members</span>
        </div>
        <div>
          <strong>{ventures.length}</strong>
          <span>Ventures</span>
        </div>
        <div>
          <strong>
            {ventures.filter((row) => row.action === 'Awaiting mentor assignment').length}
          </strong>
          <span>Awaiting mentor assignment</span>
        </div>
        <div>
          <strong>{ventures.filter((row) => row.assessments === row.stages.length).length}</strong>
          <span>Ventures with all stages assessed</span>
        </div>
      </div>
      <VentureProgressTable
        key={institution.id}
        members={report.members}
        href={href}
        exportName="yerh-member-progress.csv"
        filterable
      />
    </>
  );
}
