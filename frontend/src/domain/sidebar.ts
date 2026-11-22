import { contentPath, type ContentItem, type ContentKind } from './content.ts';
import type { DemoState, Thread } from './demo';

export interface SidebarData {
  featuredIds: string[];
  featuredCourseIds: string[];
  popularity: { contentId: string; likes: number }[];
  popularitySource: string;
  comments: { id: string; contentId: string; authorId: string; body: string; createdAt: string }[];
  advertisements: {
    id: string;
    title: string;
    text: string;
    action: string;
    href: string;
    image: string | null;
    imageAlt: string;
  }[];
}

export function readingRecommendations(
  items: ContentItem[],
  currentId?: string,
  kind?: ContentKind,
) {
  const current = items.find((i) => i.id === currentId);
  const preferredKind = current?.kind ?? kind;
  return items
    .filter(
      (i) => i.id !== currentId && ['article', 'story', 'publication', 'resource'].includes(i.kind),
    )
    .sort(
      (a, b) =>
        Number(b.category === current?.category) - Number(a.category === current?.category) ||
        Number(b.kind === preferredKind) - Number(a.kind === preferredKind) ||
        (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '') ||
        a.title.localeCompare(b.title),
    )
    .slice(0, 3);
}
export function popularContent(items: ContentItem[], data: SidebarData, excludeId?: string) {
  return data.popularity
    .flatMap((record) => {
      const item = items.find((i) => i.id === record.contentId && i.id !== excludeId);
      return item ? [{ item, likes: record.likes }] : [];
    })
    .sort((a, b) => b.likes - a.likes || a.item.title.localeCompare(b.item.title))
    .slice(0, 3);
}
export interface SidebarComment {
  id: string;
  authorId: string;
  body: string;
  title: string;
  href: string;
  createdAt: string;
  context: 'article' | 'forum';
}
export function recentComments(
  items: ContentItem[],
  data: SidebarData,
  state: DemoState,
): SidebarComment[] {
  const articleComments = data.comments.flatMap((c) => {
    const item = items.find((i) => i.id === c.contentId);
    return item && state.accounts.some((a) => a.id === c.authorId)
      ? [
          {
            ...c,
            title: item.title,
            href: `${contentPath(item)}#comment-${encodeURIComponent(c.id)}`,
            context: 'article' as const,
          },
        ]
      : [];
  });
  const replies = state.threads
    .filter((t) => !t.hidden)
    .flatMap((t) =>
      t.replies.map((r) => ({
        ...r,
        title: t.title,
        href: `/forums/${encodeURIComponent(t.id)}#reply-${encodeURIComponent(r.id)}`,
        context: 'forum' as const,
      })),
    );
  return [...articleComments, ...replies].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id),
  );
}

export function isCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1900) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
/** Canonical calendar day in the programme timezone, including UTC-midnight boundary cases. */
export function nairobiDay(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function discussionDays(thread: Thread): string[] {
  return [
    ...new Set(
      [thread.createdAt, ...thread.replies.map((r) => r.createdAt)].map(nairobiDay).filter(Boolean),
    ),
  ];
}
export function discussionsOnDay(threads: Thread[], day: string): Thread[] {
  return threads.filter(
    (t) => !t.hidden && (!isCalendarDay(day) || discussionDays(t).includes(day)),
  );
}
export function discussionDayCounts(threads: Thread[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of threads.filter((t) => !t.hidden))
    for (const day of discussionDays(t)) counts[day] = (counts[day] ?? 0) + 1;
  return counts;
}
export function shiftCalendarMonth(month: string, offset: number): string {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}
export function calendarCells(month: string): (string | null)[] {
  if (!isCalendarDay(`${month}-01`)) return [];
  const first = new Date(`${month}-01T12:00:00Z`);
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: (first.getUTCDay() + 6) % 7 }, () => null);
  for (let day = 1; day <= days; day++) cells.push(`${month}-${String(day).padStart(2, '0')}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}
