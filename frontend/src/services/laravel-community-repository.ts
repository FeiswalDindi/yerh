import { laravelRequest } from './laravel-api';

export interface ForumCategory {
  id: number;
  slug: string;
  name: string;
  description: string;
  position: number;
  is_active: boolean;
  thread_count?: number;
  reply_count?: number;
}

export interface CommunityThreadSummary {
  id: number;
  forum_id: number | null;
  forum_slug?: string | null;
  forum_name?: string | null;
  group_id?: number | null;
  author_id: number;
  author_name: string;
  author_role: string;
  title: string;
  body: string;
  accepted_reply_id: number | null;
  pinned: boolean;
  locked: boolean;
  hidden: boolean;
  reply_count: number;
  latest_reply_author?: string | null;
  latest_reply_at?: string | null;
  latest_activity_at?: string | null;
  activity_dates?: string[];
  created_at: string;
}

export interface CommunityReply {
  id: number;
  thread_id: number;
  author_id: number;
  author_name: string;
  author_role: string;
  body: string;
  hidden: boolean;
  votes_count: number;
  voted_by_me: boolean;
  created_at: string;
}

export interface ThreadDetailPayload {
  thread: {
    id: number;
    forum_id: number | null;
    forum_slug: string | null;
    forum_name: string | null;
    group_id: number | null;
    group_slug: string | null;
    group_name: string | null;
    author_id: number;
    author_name: string;
    author_role: string;
    title: string;
    body: string;
    accepted_reply_id: number | null;
    pinned: boolean;
    locked: boolean;
    hidden: boolean;
    created_at: string;
  };
  replies: CommunityReply[];
  can_reply: boolean;
  can_mark_solution: boolean;
  can_moderate: boolean;
}

export interface ForumsFeedPayload {
  forums: ForumCategory[];
  threads: CommunityThreadSummary[];
  activity_days: Record<string, number>;
}

export interface ArticleCommentRecord {
  id: number;
  content_id: string;
  user_id: number;
  author_name: string;
  author_role: string;
  body: string;
  hidden: boolean;
  can_delete: boolean;
  created_at: string;
}

export interface ArticleEngagementPayload {
  likes_count: number;
  liked: boolean;
  comments: ArticleCommentRecord[];
  can_moderate: boolean;
}

export interface CommunitySidebarPayload {
  comments: {
    id: string;
    author_id: number;
    author_name: string;
    author_role: string;
    body: string;
    title: string;
    href: string;
    created_at: string;
    context: 'article' | 'forum';
  }[];
  popularity: { content_id: string; likes: number }[];
  threads: {
    id: number;
    title: string;
    forum_slug: string;
    forum_name: string;
    author_id: number;
    author_name: string;
    author_role: string;
    reply_count: number;
    updated_at: string;
  }[];
  featuredCourses: {
    id: number;
    slug: string;
    title: string;
    level: string;
    lesson_count: number;
    is_moodle: boolean;
  }[];
}

export interface CommunityMemberProfilePayload {
  member: {
    id: number;
    name: string;
    role: string;
    avatar: string | null;
    location: string | null;
    headline: string | null;
    bio: string | null;
    institution: { name: string; slug: string; kind: string } | null;
    joined_at: string;
  };
  stats: {
    groups_count: number;
    threads_count: number;
    replies_count: number;
    comments_count: number;
    solutions_count: number;
    helpful_votes_received: number;
  };
  leaderboard: {
    month: LeaderboardEntry | null;
    all: LeaderboardEntry | null;
  };
  groups: {
    id: number;
    slug: string;
    name: string;
    category: string;
    member_count: number;
    joined_at: string;
  }[];
  threads: {
    id: number;
    title: string;
    forum_slug: string;
    forum_name: string;
    reply_count: number;
    accepted_reply_id: number | null;
    created_at: string;
  }[];
  replies: {
    id: number;
    thread_id: number;
    thread_title: string;
    forum_name: string;
    body: string;
    votes_count: number;
    is_solution: boolean;
    created_at: string;
  }[];
  comments: {
    id: number;
    content_id: string;
    article_title: string;
    href: string;
    body: string;
    created_at: string;
  }[];
  ventures: {
    id: number;
    name: string;
    sector: string;
    location: string;
  }[];
  activity: {
    id: string;
    kind: 'thread' | 'reply' | 'comment' | 'group';
    title: string;
    summary: string;
    href: string;
    created_at: string;
  }[];
}

export interface CommunityGroupRecord {
  id: number;
  slug: string;
  name: string;
  category: string;
  description: string;
  is_active: boolean;
  joined: boolean;
  has_whatsapp: boolean;
  whatsapp_url: string | null;
  member_count: number;
  thread_count?: number;
}

export interface LeaderboardEntry {
  user_id: number;
  name: string;
  role: string;
  points: number;
  rank: number;
  position: number;
  breakdown: {
    courses: number;
    stages: number;
    solutions: number;
    events: number;
    topics: number;
    votes: number;
    replies: number;
  };
}

export interface LeaderboardPayload {
  period: 'month' | 'all';
  rules: Record<string, number>;
  top: LeaderboardEntry[];
  me: LeaderboardEntry | null;
}

export interface CommunityModerationPayload {
  forums: ForumCategory[];
  threads: {
    id: number;
    title: string;
    body: string;
    context: string;
    author_name: string;
    author_role: string;
    pinned: boolean;
    locked: boolean;
    hidden: boolean;
    created_at: string;
  }[];
  replies: {
    id: number;
    thread_id: number;
    thread_title: string;
    body: string;
    author_name: string;
    author_role: string;
    hidden: boolean;
    created_at: string;
  }[];
  comments: {
    id: number;
    content_id: string;
    article_title: string;
    body: string;
    author_name: string;
    author_role: string;
    hidden: boolean;
    created_at: string;
  }[];
}

export const communityRepository = {
  async forums(
    params?: { forum?: string; q?: string; filter?: string; date?: string; include_hidden?: boolean },
    signal?: AbortSignal,
  ): Promise<ForumsFeedPayload> {
    const query = new URLSearchParams();
    if (params?.forum && params.forum !== 'all') query.set('forum', params.forum);
    if (params?.q) query.set('q', params.q);
    if (params?.filter && params.filter !== 'all') query.set('filter', params.filter);
    if (params?.date) query.set('date', params.date);
    if (params?.include_hidden) query.set('include_hidden', '1');
    const qs = query.toString();
    return (
      await laravelRequest<{ data: ForumsFeedPayload }>(`/community/forums${qs ? `?${qs}` : ''}`, {
        signal,
      })
    ).data;
  },

  async thread(id: number | string, signal?: AbortSignal): Promise<ThreadDetailPayload> {
    return (
      await laravelRequest<{ data: ThreadDetailPayload }>(
        `/community/threads/${encodeURIComponent(String(id))}`,
        { signal },
      )
    ).data;
  },

  async createThread(data: {
    forum_id?: number;
    group_id?: number;
    title: string;
    body: string;
  }): Promise<{ id: number }> {
    return (
      await laravelRequest<{ data: { id: number } }>('/community/threads', {
        method: 'POST',
        data,
      })
    ).data;
  },

  async createReply(threadId: number, body: string): Promise<{ id: number }> {
    return (
      await laravelRequest<{ data: { id: number } }>(`/community/threads/${threadId}/replies`, {
        method: 'POST',
        data: { body },
      })
    ).data;
  },

  async toggleVote(replyId: number): Promise<{ voted: boolean; votes_count: number }> {
    return (
      await laravelRequest<{ data: { voted: boolean; votes_count: number } }>(
        `/community/replies/${replyId}/vote`,
        { method: 'POST' },
      )
    ).data;
  },

  async markSolution(
    threadId: number,
    replyId: number | null,
  ): Promise<{ accepted_reply_id: number | null }> {
    return (
      await laravelRequest<{ data: { accepted_reply_id: number | null } }>(
        `/community/threads/${threadId}/solution`,
        { method: 'POST', data: { reply_id: replyId } },
      )
    ).data;
  },

  async articleEngagement(
    contentId: string,
    includeHidden = false,
    signal?: AbortSignal,
  ): Promise<ArticleEngagementPayload> {
    const qs = includeHidden ? '?include_hidden=1' : '';
    return (
      await laravelRequest<{ data: ArticleEngagementPayload }>(
        `/community/articles/${encodeURIComponent(contentId)}/engagement${qs}`,
        { signal },
      )
    ).data;
  },

  async toggleArticleLike(contentId: string): Promise<{ liked: boolean; likes_count: number }> {
    return (
      await laravelRequest<{ data: { liked: boolean; likes_count: number } }>(
        `/community/articles/${encodeURIComponent(contentId)}/like`,
        { method: 'POST' },
      )
    ).data;
  },

  async commentOnArticle(contentId: string, body: string): Promise<ArticleCommentRecord> {
    return (
      await laravelRequest<{ data: ArticleCommentRecord }>(
        `/community/articles/${encodeURIComponent(contentId)}/comments`,
        { method: 'POST', data: { body } },
      )
    ).data;
  },

  async deleteArticleComment(commentId: number): Promise<void> {
    await laravelRequest(`/community/articles/comments/${commentId}`, { method: 'DELETE' });
  },

  async sidebar(signal?: AbortSignal): Promise<CommunitySidebarPayload> {
    return (
      await laravelRequest<{ data: CommunitySidebarPayload }>('/community/sidebar', { signal })
    ).data;
  },

  async groups(includeInactive = false, signal?: AbortSignal): Promise<CommunityGroupRecord[]> {
    const qs = includeInactive ? '?include_inactive=1' : '';
    return (
      await laravelRequest<{ data: CommunityGroupRecord[] }>(`/community/groups${qs}`, { signal })
    ).data;
  },

  async group(
    slug: string,
    signal?: AbortSignal,
  ): Promise<{ group: CommunityGroupRecord; threads: CommunityThreadSummary[] }> {
    return (
      await laravelRequest<{
        data: { group: CommunityGroupRecord; threads: CommunityThreadSummary[] };
      }>(`/community/groups/${encodeURIComponent(slug)}`, { signal })
    ).data;
  },

  async memberProfile(
    userId: number | string,
    signal?: AbortSignal,
  ): Promise<CommunityMemberProfilePayload> {
    return (
      await laravelRequest<{ data: CommunityMemberProfilePayload }>(
        `/community/members/${encodeURIComponent(String(userId))}`,
        { signal },
      )
    ).data;
  },

  async toggleGroupMembership(slug: string): Promise<{
    joined: boolean;
    member_count: number;
    has_whatsapp: boolean;
    whatsapp_url: string | null;
  }> {
    return (
      await laravelRequest<{
        data: {
          joined: boolean;
          member_count: number;
          has_whatsapp: boolean;
          whatsapp_url: string | null;
        };
      }>(`/community/groups/${encodeURIComponent(slug)}/membership`, { method: 'POST' })
    ).data;
  },

  async leaderboard(
    period: 'month' | 'all' = 'month',
    signal?: AbortSignal,
  ): Promise<LeaderboardPayload> {
    return (
      await laravelRequest<{ data: LeaderboardPayload }>(
        `/community/leaderboard?period=${encodeURIComponent(period)}`,
        { signal },
      )
    ).data;
  },

  async saveForum(
    data: { name: string; description: string; position?: number; is_active?: boolean },
    id?: number,
  ): Promise<{ id: number }> {
    return (
      await laravelRequest<{ data: { id: number } }>(
        id ? `/community/manage/forums/${id}` : '/community/manage/forums',
        { method: id ? 'PATCH' : 'POST', data },
      )
    ).data;
  },

  async saveGroup(
    data: {
      name: string;
      category: string;
      description: string;
      whatsapp_url?: string | null;
      is_active?: boolean;
    },
    id?: number,
  ): Promise<{ id: number }> {
    return (
      await laravelRequest<{ data: { id: number } }>(
        id ? `/community/manage/groups/${id}` : '/community/manage/groups',
        { method: id ? 'PATCH' : 'POST', data },
      )
    ).data;
  },

  async moderation(signal?: AbortSignal): Promise<CommunityModerationPayload> {
    return (
      await laravelRequest<{ data: CommunityModerationPayload }>('/community/manage/moderation', {
        signal,
      })
    ).data;
  },

  async moderateThread(
    id: number,
    data: { hidden?: boolean; pinned?: boolean; locked?: boolean },
  ): Promise<void> {
    await laravelRequest(`/community/manage/threads/${id}`, { method: 'PATCH', data });
  },

  async moderateReply(id: number, hidden: boolean): Promise<void> {
    await laravelRequest(`/community/manage/replies/${id}`, {
      method: 'PATCH',
      data: { hidden },
    });
  },

  async moderateComment(id: number, hidden: boolean): Promise<void> {
    await laravelRequest(`/community/manage/comments/${id}`, {
      method: 'PATCH',
      data: { hidden },
    });
  },
};
