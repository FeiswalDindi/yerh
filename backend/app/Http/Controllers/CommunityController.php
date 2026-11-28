<?php

namespace App\Http\Controllers;

use App\Domain\Engagement\Publishing;
use App\Domain\Incubation\Curriculum;
use App\Domain\Learning\CoursePlacements;
use App\Models\User;
use App\Support\WorkspaceNotifier;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class CommunityController extends Controller
{
    public function forums(Request $request): JsonResponse
    {
        $user = $request->user();
        $isModerator = $this->isModerator($user);
        $includeHidden = $isModerator && $request->boolean('include_hidden');

        $forums = DB::table('community_forums')
            ->where('is_active', true)
            ->orderBy('position')
            ->orderBy('name')
            ->get(['id', 'slug', 'name', 'description', 'position', 'is_active'])
            ->map(function ($forum) {
                $threads = DB::table('community_threads')
                    ->where('forum_id', $forum->id)
                    ->where('hidden', false)
                    ->pluck('id');
                $repliesCount = $threads->isEmpty()
                    ? 0
                    : DB::table('community_replies')
                        ->whereIn('thread_id', $threads)
                        ->where('hidden', false)
                        ->count();

                return [
                    'id' => (int) $forum->id,
                    'slug' => $forum->slug,
                    'name' => $forum->name,
                    'description' => $forum->description,
                    'position' => (int) $forum->position,
                    'is_active' => (bool) $forum->is_active,
                    'thread_count' => $threads->count(),
                    'reply_count' => $repliesCount,
                ];
            })
            ->values();

        $forumFilter = trim((string) $request->query('forum', ''));
        $search = mb_strtolower(trim((string) $request->query('q', '')));
        $filter = trim((string) $request->query('filter', 'all'));
        $date = trim((string) $request->query('date', ''));

        $threadQuery = DB::table('community_threads as t')
            ->join('community_forums as f', 'f.id', '=', 't.forum_id')
            ->join('users as author', 'author.id', '=', 't.author_id')
            ->whereNull('t.group_id')
            ->where('f.is_active', true);

        if (! $includeHidden) {
            $threadQuery->where('t.hidden', false);
        }

        if ($forumFilter !== '' && $forumFilter !== 'all') {
            if (ctype_digit($forumFilter)) {
                $threadQuery->where('f.id', (int) $forumFilter);
            } else {
                $threadQuery->where('f.slug', $forumFilter);
            }
        }

        if ($filter === 'solved') {
            $threadQuery->whereNotNull('t.accepted_reply_id');
        }

        $rawThreads = $threadQuery->get([
            't.id',
            't.forum_id',
            'f.slug as forum_slug',
            'f.name as forum_name',
            't.author_id',
            'author.name as author_name',
            'author.role as author_role',
            't.title',
            't.body',
            't.accepted_reply_id',
            't.pinned',
            't.locked',
            't.hidden',
            't.created_at',
            't.updated_at',
        ]);

        $threadIds = $rawThreads->pluck('id');
        $replies = $threadIds->isEmpty()
            ? collect()
            : DB::table('community_replies as r')
                ->join('users as u', 'u.id', '=', 'r.author_id')
                ->whereIn('r.thread_id', $threadIds)
                ->where('r.hidden', false)
                ->orderBy('r.created_at')
                ->get(['r.id', 'r.thread_id', 'r.author_id', 'u.name as author_name', 'r.created_at'])
                ->groupBy('thread_id');

        $serialized = $rawThreads->map(function ($row) use ($replies) {
            $threadReplies = $replies->get($row->id, collect());
            $latest = $threadReplies->last();
            $createdAtIso = $this->toIso($row->created_at);
            $latestActivityIso = $latest ? $this->toIso($latest->created_at) : $createdAtIso;
            $activityDates = collect([$createdAtIso])
                ->merge($threadReplies->map(fn ($r) => $this->toIso($r->created_at)))
                ->map(fn ($iso) => $this->nairobiDay($iso))
                ->filter()
                ->unique()
                ->values()
                ->all();

            return [
                'id' => (int) $row->id,
                'forum_id' => (int) $row->forum_id,
                'forum_slug' => $row->forum_slug,
                'forum_name' => $row->forum_name,
                'author_id' => (int) $row->author_id,
                'author_name' => $row->author_name,
                'author_role' => $row->author_role,
                'title' => $row->title,
                'body' => $row->body,
                'accepted_reply_id' => $row->accepted_reply_id ? (int) $row->accepted_reply_id : null,
                'pinned' => (bool) $row->pinned,
                'locked' => (bool) $row->locked,
                'hidden' => (bool) $row->hidden,
                'reply_count' => $threadReplies->count(),
                'latest_reply_author' => $latest?->author_name,
                'latest_reply_at' => $latest ? $this->toIso($latest->created_at) : null,
                'latest_activity_at' => $latestActivityIso,
                'activity_dates' => $activityDates,
                'created_at' => $createdAtIso,
            ];
        })->filter(function (array $thread) use ($search, $filter, $date): bool {
            if ($filter === 'unanswered' && $thread['reply_count'] > 0) {
                return false;
            }
            if ($search !== '') {
                $haystack = mb_strtolower($thread['title'].' '.$thread['body'].' '.$thread['author_name']);
                if (! str_contains($haystack, $search)) {
                    return false;
                }
            }
            if ($date !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) === 1) {
                if (! in_array($date, $thread['activity_dates'], true)) {
                    return false;
                }
            }

            return true;
        })->sort(function (array $a, array $b): int {
            if ($a['pinned'] !== $b['pinned']) {
                return $b['pinned'] <=> $a['pinned'];
            }
            $cmp = strcmp((string) $b['latest_activity_at'], (string) $a['latest_activity_at']);

            return $cmp !== 0 ? $cmp : ($b['id'] <=> $a['id']);
        })->values();

        $activityDays = [];
        foreach ($serialized as $thread) {
            foreach ($thread['activity_dates'] as $day) {
                $activityDays[$day] = ($activityDays[$day] ?? 0) + 1;
            }
        }

        return response()->json([
            'data' => [
                'forums' => $forums,
                'threads' => $serialized,
                'activity_days' => (object) $activityDays,
            ],
        ])->header('Cache-Control', 'no-store');
    }

    public function showThread(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $isModerator = $this->isModerator($user);

        $row = DB::table('community_threads as t')
            ->leftJoin('community_forums as f', 'f.id', '=', 't.forum_id')
            ->leftJoin('community_groups as g', 'g.id', '=', 't.group_id')
            ->join('users as author', 'author.id', '=', 't.author_id')
            ->where('t.id', $id)
            ->first([
                't.*',
                'f.slug as forum_slug',
                'f.name as forum_name',
                'g.slug as group_slug',
                'g.name as group_name',
                'author.name as author_name',
                'author.role as author_role',
            ]) ?? abort(404);

        if ($row->hidden && ! $isModerator) {
            abort(404);
        }

        if ($row->group_id !== null) {
            abort_unless($user && $user->isActive() && $user->hasVerifiedEmail(), 403);
            $isMember = DB::table('community_group_members')
                ->where('group_id', $row->group_id)
                ->where('user_id', $user->id)
                ->exists();
            abort_unless($isMember || $isModerator, 403, 'Join this group to view its discussions.');
        }

        $replies = DB::table('community_replies as r')
            ->join('users as author', 'author.id', '=', 'r.author_id')
            ->where('r.thread_id', $id)
            ->when(! $isModerator, fn ($q) => $q->where('r.hidden', false))
            ->orderBy('r.created_at')
            ->orderBy('r.id')
            ->get([
                'r.id',
                'r.thread_id',
                'r.author_id',
                'author.name as author_name',
                'author.role as author_role',
                'r.body',
                'r.hidden',
                'r.created_at',
            ]);

        $replyIds = $replies->pluck('id');
        $voteCounts = $replyIds->isEmpty()
            ? collect()
            : DB::table('community_reply_votes')
                ->whereIn('reply_id', $replyIds)
                ->groupBy('reply_id')
                ->selectRaw('reply_id, count(*) as total')
                ->pluck('total', 'reply_id');

        $myVotes = ($user && $replyIds->isNotEmpty())
            ? array_flip(
                DB::table('community_reply_votes')
                    ->whereIn('reply_id', $replyIds)
                    ->where('user_id', $user->id)
                    ->pluck('reply_id')
                    ->all()
            )
            : [];

        $canReply = (bool) ($user && $user->isActive() && $user->hasVerifiedEmail() && ! $row->locked && ! $row->hidden);
        $canMarkSolution = (bool) ($user && $user->isActive() && $user->hasVerifiedEmail() && (
            (int) $row->author_id === $user->id || in_array($user->role, ['mentor', 'content_manager', 'admin'], true)
        ));

        return response()->json([
            'data' => [
                'thread' => [
                    'id' => (int) $row->id,
                    'forum_id' => $row->forum_id ? (int) $row->forum_id : null,
                    'forum_slug' => $row->forum_slug,
                    'forum_name' => $row->forum_name,
                    'group_id' => $row->group_id ? (int) $row->group_id : null,
                    'group_slug' => $row->group_slug,
                    'group_name' => $row->group_name,
                    'author_id' => (int) $row->author_id,
                    'author_name' => $row->author_name,
                    'author_role' => $row->author_role,
                    'title' => $row->title,
                    'body' => $row->body,
                    'accepted_reply_id' => $row->accepted_reply_id ? (int) $row->accepted_reply_id : null,
                    'pinned' => (bool) $row->pinned,
                    'locked' => (bool) $row->locked,
                    'hidden' => (bool) $row->hidden,
                    'created_at' => $this->toIso($row->created_at),
                ],
                'replies' => $replies->map(fn ($reply) => [
                    'id' => (int) $reply->id,
                    'thread_id' => (int) $reply->thread_id,
                    'author_id' => (int) $reply->author_id,
                    'author_name' => $reply->author_name,
                    'author_role' => $reply->author_role,
                    'body' => $reply->body,
                    'hidden' => (bool) $reply->hidden,
                    'votes_count' => (int) ($voteCounts[$reply->id] ?? 0),
                    'voted_by_me' => isset($myVotes[$reply->id]),
                    'created_at' => $this->toIso($reply->created_at),
                ])->values(),
                'can_reply' => $canReply,
                'can_mark_solution' => $canMarkSolution,
                'can_moderate' => $isModerator,
            ],
        ])->header('Cache-Control', 'no-store');
    }

    public function storeThread(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'forum_id' => ['nullable', 'integer', 'min:1'],
            'group_id' => ['nullable', 'integer', 'min:1'],
            'title' => ['required', 'string', 'min:5', 'max:160'],
            'body' => ['required', 'string', 'min:10', 'max:5000'],
        ]);

        $forumId = isset($data['forum_id']) ? (int) $data['forum_id'] : null;
        $groupId = isset($data['group_id']) ? (int) $data['group_id'] : null;
        if (($forumId === null) === ($groupId === null)) {
            throw ValidationException::withMessages([
                'forum_id' => 'Choose either a forum or a community group.',
            ]);
        }

        if ($forumId !== null) {
            $forum = DB::table('community_forums')
                ->where('id', $forumId)
                ->where('is_active', true)
                ->first();
            abort_unless($forum, 404, 'Forum not found.');
        } else {
            $group = DB::table('community_groups')
                ->where('id', $groupId)
                ->where('is_active', true)
                ->first() ?? abort(404, 'Group not found.');
            $isMember = DB::table('community_group_members')
                ->where('group_id', $group->id)
                ->where('user_id', $user->id)
                ->exists();
            abort_unless($isMember || $this->isModerator($user), 403, 'Join this group before starting a discussion.');
        }

        $now = now();
        $id = DB::table('community_threads')->insertGetId([
            'forum_id' => $forumId,
            'group_id' => $groupId,
            'author_id' => $user->id,
            'title' => trim($data['title']),
            'body' => trim($data['body']),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return response()->json(['data' => ['id' => $id]], 201);
    }

    public function storeReply(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'body' => ['required', 'string', 'min:2', 'max:3000'],
        ]);

        $thread = DB::table('community_threads')->where('id', $id)->first() ?? abort(404);
        abort_if($thread->hidden, 404);
        abort_if($thread->locked, 409, 'This discussion is locked.');

        if ($thread->group_id !== null) {
            $isMember = DB::table('community_group_members')
                ->where('group_id', $thread->group_id)
                ->where('user_id', $user->id)
                ->exists();
            abort_unless($isMember || $this->isModerator($user), 403, 'Join this group to reply.');
        }

        $now = now();
        $replyId = DB::table('community_replies')->insertGetId([
            'thread_id' => $id,
            'author_id' => $user->id,
            'body' => trim($data['body']),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('community_threads')->where('id', $id)->update(['updated_at' => $now]);

        if ((int) $thread->author_id !== $user->id) {
            if ($thread->group_id) {
                $groupSlug = DB::table('community_groups')->where('id', $thread->group_id)->value('slug');
                $link = $groupSlug ? '/groups/'.$groupSlug : '/groups';
            } else {
                $link = '/forums/'.$id.'#reply-'.$replyId;
            }
            WorkspaceNotifier::notifyUser(
                (int) $thread->author_id,
                "{$user->name} replied to your discussion \"{$thread->title}\".",
                $link,
            );
        }

        return response()->json(['data' => ['id' => $replyId]], 201);
    }

    public function toggleVote(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $reply = DB::table('community_replies as r')
            ->join('community_threads as t', 't.id', '=', 'r.thread_id')
            ->where('r.id', $id)
            ->first(['r.id', 'r.hidden', 't.hidden as thread_hidden', 't.group_id']) ?? abort(404);

        abort_if($reply->hidden || $reply->thread_hidden, 404);

        if ($reply->group_id !== null) {
            $isMember = DB::table('community_group_members')
                ->where('group_id', $reply->group_id)
                ->where('user_id', $user->id)
                ->exists();
            abort_unless($isMember || $this->isModerator($user), 403);
        }

        $existing = DB::table('community_reply_votes')
            ->where('reply_id', $id)
            ->where('user_id', $user->id);

        if ($existing->exists()) {
            $existing->delete();
            $voted = false;
        } else {
            DB::table('community_reply_votes')->insert([
                'reply_id' => $id,
                'user_id' => $user->id,
                'created_at' => now(),
            ]);
            $voted = true;
        }

        $count = DB::table('community_reply_votes')->where('reply_id', $id)->count();

        return response()->json(['data' => ['voted' => $voted, 'votes_count' => $count]]);
    }

    public function markSolution(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'reply_id' => ['nullable', 'integer', 'min:1'],
        ]);

        $thread = DB::table('community_threads')->where('id', $id)->first() ?? abort(404);
        abort_if($thread->hidden, 404);

        $allowed = (int) $thread->author_id === $user->id
            || in_array($user->role, ['mentor', 'content_manager', 'admin'], true);
        abort_unless($allowed, 403, 'Only the question author or a mentor can mark a solution.');

        $replyId = $data['reply_id'] ?? null;
        $replyAuthorId = null;
        if ($replyId !== null) {
            $reply = DB::table('community_replies')
                ->where('id', $replyId)
                ->where('thread_id', $id)
                ->where('hidden', false)
                ->first(['id', 'author_id']);
            abort_unless($reply, 404, 'Reply not found in this discussion.');
            $replyAuthorId = (int) $reply->author_id;
        }

        DB::table('community_threads')->where('id', $id)->update([
            'accepted_reply_id' => $replyId,
            'updated_at' => now(),
        ]);

        if ($replyId !== null && $replyAuthorId && $replyAuthorId !== $user->id && $thread->group_id === null) {
            WorkspaceNotifier::notifyUser(
                $replyAuthorId,
                "Your reply in \"{$thread->title}\" was marked as the accepted solution.",
                '/forums/'.$id.'#reply-'.$replyId,
            );
        }

        return response()->json(['data' => ['accepted_reply_id' => $replyId]]);
    }

    public function articleEngagement(Request $request, string $contentId): JsonResponse
    {
        $user = $request->user();
        $isModerator = $this->isModerator($user);
        $includeHidden = $isModerator && $request->boolean('include_hidden');

        $likesCount = DB::table('editorial_likes')->where('content_id', $contentId)->count();
        $liked = $user
            ? DB::table('editorial_likes')
                ->where('content_id', $contentId)
                ->where('user_id', $user->id)
                ->exists()
            : false;

        $comments = DB::table('editorial_comments as c')
            ->join('users as u', 'u.id', '=', 'c.user_id')
            ->where('c.content_id', $contentId)
            ->when(! $includeHidden, fn ($q) => $q->where('c.hidden', false))
            ->orderByDesc('c.created_at')
            ->orderByDesc('c.id')
            ->get([
                'c.id',
                'c.content_id',
                'c.user_id',
                'u.name as author_name',
                'u.role as author_role',
                'c.body',
                'c.hidden',
                'c.created_at',
            ])
            ->map(fn ($row) => [
                'id' => (int) $row->id,
                'content_id' => $row->content_id,
                'user_id' => (int) $row->user_id,
                'author_name' => $row->author_name,
                'author_role' => $row->author_role,
                'body' => $row->body,
                'hidden' => (bool) $row->hidden,
                'can_delete' => (bool) ($user && ((int) $row->user_id === $user->id || $isModerator)),
                'created_at' => $this->toIso($row->created_at),
            ])
            ->values();

        return response()->json([
            'data' => [
                'likes_count' => $likesCount,
                'liked' => $liked,
                'comments' => $comments,
                'can_moderate' => $isModerator,
            ],
        ])->header('Cache-Control', 'no-store');
    }

    public function toggleArticleLike(Request $request, string $contentId): JsonResponse
    {
        $user = $request->user();
        $existing = DB::table('editorial_likes')
            ->where('content_id', $contentId)
            ->where('user_id', $user->id);

        if ($existing->exists()) {
            $existing->delete();
            $liked = false;
        } else {
            DB::table('editorial_likes')->insert([
                'content_id' => $contentId,
                'user_id' => $user->id,
                'created_at' => now(),
            ]);
            $liked = true;
        }

        $count = DB::table('editorial_likes')->where('content_id', $contentId)->count();

        return response()->json(['data' => ['liked' => $liked, 'likes_count' => $count]]);
    }

    public function storeArticleComment(Request $request, string $contentId): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'body' => ['required', 'string', 'min:2', 'max:2000'],
        ]);

        $now = now();
        $id = DB::table('editorial_comments')->insertGetId([
            'content_id' => $contentId,
            'user_id' => $user->id,
            'body' => trim($data['body']),
            'hidden' => false,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return response()->json([
            'data' => [
                'id' => $id,
                'content_id' => $contentId,
                'user_id' => $user->id,
                'author_name' => $user->name,
                'author_role' => $user->role,
                'body' => trim($data['body']),
                'hidden' => false,
                'can_delete' => true,
                'created_at' => $now->toIso8601String(),
            ],
        ], 201);
    }

    public function deleteArticleComment(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $comment = DB::table('editorial_comments')->where('id', $id)->first(['id', 'user_id']) ?? abort(404);
        abort_unless((int) $comment->user_id === $user->id || $this->isModerator($user), 403);

        DB::table('editorial_comments')->where('id', $id)->delete();

        return response()->json(['data' => ['deleted' => true]]);
    }

    public function sidebar(CoursePlacements $placements): JsonResponse
    {
        $publishedEditorial = DB::table('editorial_content')
            ->where('status', 'published')
            ->get(['content_id', 'kind', 'slug', 'payload'])
            ->keyBy('content_id');

        $kindPaths = [
            'article' => '/publications/blogs',
            'story' => '/publications/stories',
            'business' => '/marketplace',
            'event' => '/events',
            'publication' => '/publications/reports',
            'resource' => '/resources',
        ];

        $articleComments = DB::table('editorial_comments as c')
            ->join('users as u', 'u.id', '=', 'c.user_id')
            ->where('c.hidden', false)
            ->orderByDesc('c.created_at')
            ->limit(10)
            ->get(['c.id', 'c.user_id', 'c.content_id', 'u.name as author_name', 'u.role as author_role', 'c.body', 'c.created_at'])
            ->flatMap(function ($row) use ($publishedEditorial, $kindPaths) {
                $item = $publishedEditorial->get($row->content_id);
                if (! $item) {
                    return [];
                }
                $decoded = json_decode($item->payload, true);
                $basePath = $kindPaths[$item->kind] ?? '/publications/blogs';

                return [[
                    'id' => 'article-'.$row->id,
                    'author_id' => (int) $row->user_id,
                    'author_name' => $row->author_name,
                    'author_role' => $row->author_role,
                    'body' => Str::limit($row->body, 140),
                    'title' => (string) ($decoded['title'] ?? 'Article'),
                    'href' => $basePath.'/'.rawurlencode($item->slug).'#comment-'.$row->id,
                    'created_at' => $this->toIso($row->created_at),
                    'context' => 'article',
                ]];
            });

        $forumReplies = DB::table('community_replies as r')
            ->join('community_threads as t', 't.id', '=', 'r.thread_id')
            ->join('community_forums as f', 'f.id', '=', 't.forum_id')
            ->join('users as u', 'u.id', '=', 'r.author_id')
            ->whereNull('t.group_id')
            ->where('t.hidden', false)
            ->where('r.hidden', false)
            ->where('f.is_active', true)
            ->orderByDesc('r.created_at')
            ->limit(10)
            ->get(['r.id', 'r.thread_id', 't.title', 'r.author_id', 'u.name as author_name', 'u.role as author_role', 'r.body', 'r.created_at'])
            ->map(fn ($row) => [
                'id' => 'reply-'.$row->id,
                'author_id' => (int) $row->author_id,
                'author_name' => $row->author_name,
                'author_role' => $row->author_role,
                'body' => Str::limit($row->body, 140),
                'title' => $row->title,
                'href' => '/forums/'.$row->thread_id.'#reply-'.$row->id,
                'created_at' => $this->toIso($row->created_at),
                'context' => 'forum',
            ]);

        $comments = $articleComments->merge($forumReplies)
            ->sortByDesc('created_at')
            ->take(4)
            ->values();

        $popularity = DB::table('editorial_likes')
            ->groupBy('content_id')
            ->selectRaw('content_id, count(*) as likes')
            ->orderByDesc('likes')
            ->limit(10)
            ->get()
            ->filter(fn ($row) => $publishedEditorial->has($row->content_id))
            ->take(3)
            ->map(fn ($row) => [
                'content_id' => $row->content_id,
                'likes' => (int) $row->likes,
            ])
            ->values();

        $threads = DB::table('community_threads as t')
            ->join('community_forums as f', 'f.id', '=', 't.forum_id')
            ->join('users as u', 'u.id', '=', 't.author_id')
            ->whereNull('t.group_id')
            ->where('t.hidden', false)
            ->where('f.is_active', true)
            ->orderByDesc('t.updated_at')
            ->limit(3)
            ->get(['t.id', 't.title', 'f.slug as forum_slug', 'f.name as forum_name', 't.author_id', 'u.name as author_name', 'u.role as author_role', 't.updated_at'])
            ->map(function ($row) {
                $replyCount = DB::table('community_replies')
                    ->where('thread_id', $row->id)
                    ->where('hidden', false)
                    ->count();

                return [
                    'id' => (int) $row->id,
                    'title' => $row->title,
                    'forum_slug' => $row->forum_slug,
                    'forum_name' => $row->forum_name,
                    'author_id' => (int) $row->author_id,
                    'author_name' => $row->author_name,
                    'author_role' => $row->author_role,
                    'reply_count' => $replyCount,
                    'updated_at' => $this->toIso($row->updated_at),
                ];
            })
            ->values();

        $publicPlacements = $placements->publicKeys();
        $featuredCourses = $publicPlacements === []
            ? collect()
            : DB::table('learning_courses')
                ->where('status', 'published')
                ->whereIn('placement', $publicPlacements)
                ->orderByDesc('featured')
                ->orderBy('id')
                ->limit(3)
                ->get(['id', 'slug', 'title', 'level', 'moodle_course_id'])
                ->map(fn ($course) => [
                    'id' => (int) $course->id,
                    'slug' => $course->slug,
                    'title' => $course->title,
                    'level' => $course->level,
                    'lesson_count' => DB::table('learning_lessons')->where('course_id', $course->id)->count(),
                    'is_moodle' => $course->moodle_course_id !== null,
                ])
                ->values();

        return response()->json([
            'data' => compact('comments', 'popularity', 'threads', 'featuredCourses'),
        ])->header('Cache-Control', 'no-store');
    }

    public function groups(Request $request): JsonResponse
    {
        $user = $request->user();
        $isVerified = $user !== null && $user->isActive() && $user->hasVerifiedEmail();
        $isModerator = $this->isModerator($user);
        $includeInactive = $isModerator && $request->boolean('include_inactive');

        $joinedIds = $isVerified
            ? array_flip(
                DB::table('community_group_members')
                    ->where('user_id', $user->id)
                    ->pluck('group_id')
                    ->all()
            )
            : [];

        $rows = DB::table('community_groups')
            ->when(! $includeInactive, fn ($q) => $q->where('is_active', true))
            ->orderBy('name')
            ->get()
            ->map(function ($group) use ($joinedIds, $isModerator) {
                $joined = isset($joinedIds[$group->id]);
                $hasWhatsapp = ! empty($group->whatsapp_url);

                return [
                    'id' => (int) $group->id,
                    'slug' => $group->slug,
                    'name' => $group->name,
                    'category' => $group->category,
                    'description' => $group->description,
                    'is_active' => (bool) $group->is_active,
                    'joined' => $joined,
                    'has_whatsapp' => $hasWhatsapp,
                    'whatsapp_url' => ($joined || $isModerator) ? $group->whatsapp_url : null,
                    'member_count' => DB::table('community_group_members')->where('group_id', $group->id)->count(),
                    'thread_count' => DB::table('community_threads')->where('group_id', $group->id)->where('hidden', false)->count(),
                ];
            })
            ->values();

        return response()->json(['data' => $rows])->header('Cache-Control', 'no-store');
    }

    public function showGroup(Request $request, string $slug): JsonResponse
    {
        $user = $request->user();
        $isVerified = $user !== null && $user->isActive() && $user->hasVerifiedEmail();
        $isModerator = $this->isModerator($user);

        $group = DB::table('community_groups')
            ->where('slug', $slug)
            ->when(! $isModerator, fn ($q) => $q->where('is_active', true))
            ->first() ?? abort(404);

        $joined = $isVerified && DB::table('community_group_members')
            ->where('group_id', $group->id)
            ->where('user_id', $user->id)
            ->exists();

        $threads = collect();
        if ($joined || $isModerator) {
            $rawThreads = DB::table('community_threads as t')
                ->join('users as author', 'author.id', '=', 't.author_id')
                ->where('t.group_id', $group->id)
                ->when(! $isModerator, fn ($q) => $q->where('t.hidden', false))
                ->orderByDesc('t.pinned')
                ->orderByDesc('t.updated_at')
                ->get([
                    't.*',
                    'author.name as author_name',
                    'author.role as author_role',
                ]);

            $threadIds = $rawThreads->pluck('id');
            $replyCounts = $threadIds->isEmpty()
                ? collect()
                : DB::table('community_replies')
                    ->whereIn('thread_id', $threadIds)
                    ->where('hidden', false)
                    ->groupBy('thread_id')
                    ->selectRaw('thread_id, count(*) as total')
                    ->pluck('total', 'thread_id');

            $threads = $rawThreads->map(fn ($row) => [
                'id' => (int) $row->id,
                'group_id' => (int) $row->group_id,
                'author_id' => (int) $row->author_id,
                'author_name' => $row->author_name,
                'author_role' => $row->author_role,
                'title' => $row->title,
                'body' => $row->body,
                'accepted_reply_id' => $row->accepted_reply_id ? (int) $row->accepted_reply_id : null,
                'pinned' => (bool) $row->pinned,
                'locked' => (bool) $row->locked,
                'hidden' => (bool) $row->hidden,
                'reply_count' => (int) ($replyCounts[$row->id] ?? 0),
                'created_at' => $this->toIso($row->created_at),
            ])->values();
        }

        return response()->json([
            'data' => [
                'group' => [
                    'id' => (int) $group->id,
                    'slug' => $group->slug,
                    'name' => $group->name,
                    'category' => $group->category,
                    'description' => $group->description,
                    'is_active' => (bool) $group->is_active,
                    'joined' => $joined,
                    'has_whatsapp' => ! empty($group->whatsapp_url),
                    'whatsapp_url' => ($joined || $isModerator) ? $group->whatsapp_url : null,
                    'member_count' => DB::table('community_group_members')->where('group_id', $group->id)->count(),
                ],
                'threads' => $threads,
            ],
        ])->header('Cache-Control', 'no-store');
    }

    public function toggleGroupMembership(Request $request, string $slug): JsonResponse
    {
        $user = $request->user();

        $group = DB::table('community_groups')
            ->where('slug', $slug)
            ->where('is_active', true)
            ->first() ?? abort(404);

        $existing = DB::table('community_group_members')
            ->where('group_id', $group->id)
            ->where('user_id', $user->id);

        if ($existing->exists()) {
            $existing->delete();
            $joined = false;
        } else {
            DB::table('community_group_members')->insert([
                'group_id' => $group->id,
                'user_id' => $user->id,
                'joined_at' => now(),
            ]);
            $joined = true;
        }

        $memberCount = DB::table('community_group_members')->where('group_id', $group->id)->count();

        return response()->json([
            'data' => [
                'joined' => $joined,
                'member_count' => $memberCount,
                'has_whatsapp' => ! empty($group->whatsapp_url),
                'whatsapp_url' => $joined ? $group->whatsapp_url : null,
            ],
        ]);
    }

    public function leaderboard(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->requireDashboardMember($user);

        $period = $request->query('period') === 'all' ? 'all' : 'month';
        $board = $this->computeLeaderboard($period);
        $top = array_slice($board['ranked'], 0, 20);
        $me = collect($board['ranked'])->firstWhere('user_id', $user->id);

        return response()->json([
            'data' => [
                'period' => $period,
                'rules' => $board['rules'],
                'top' => $top,
                'me' => $me,
            ],
        ])->header('Cache-Control', 'no-store');
    }

    public function memberProfile(int $id): JsonResponse
    {
        $user = DB::table('users')
            ->where('id', $id)
            ->whereNull('suspended_at')
            ->whereNotNull('email_verified_at')
            ->first(['id', 'name', 'role', 'avatar', 'location', 'headline', 'bio', 'created_at']) ?? abort(404);

        $institution = DB::table('institution_memberships as m')
            ->join('institutions as i', 'i.id', '=', 'm.institution_id')
            ->where('m.user_id', $id)
            ->where('i.status', 'active')
            ->first(['i.name', 'i.slug', 'i.kind']);

        if (! $institution) {
            $institution = DB::table('institution_access as a')
                ->join('institutions as i', 'i.id', '=', 'a.institution_id')
                ->where('a.user_id', $id)
                ->where('i.status', 'active')
                ->first(['i.name', 'i.slug', 'i.kind']);
        }

        $groups = DB::table('community_group_members as gm')
            ->join('community_groups as g', 'g.id', '=', 'gm.group_id')
            ->where('gm.user_id', $id)
            ->where('g.is_active', true)
            ->orderByDesc('gm.joined_at')
            ->get(['g.id', 'g.slug', 'g.name', 'g.category', 'gm.joined_at'])
            ->map(fn ($g) => [
                'id' => (int) $g->id,
                'slug' => $g->slug,
                'name' => $g->name,
                'category' => $g->category,
                'member_count' => DB::table('community_group_members')->where('group_id', $g->id)->count(),
                'joined_at' => $this->toIso($g->joined_at),
            ])
            ->values();

        $rawThreads = DB::table('community_threads as t')
            ->join('community_forums as f', 'f.id', '=', 't.forum_id')
            ->whereNull('t.group_id')
            ->where('t.author_id', $id)
            ->where('t.hidden', false)
            ->where('f.is_active', true)
            ->orderByDesc('t.created_at')
            ->limit(25)
            ->get([
                't.id',
                't.title',
                'f.slug as forum_slug',
                'f.name as forum_name',
                't.accepted_reply_id',
                't.created_at',
            ]);

        $threadIds = $rawThreads->pluck('id');
        $replyCounts = $threadIds->isEmpty()
            ? collect()
            : DB::table('community_replies')
                ->whereIn('thread_id', $threadIds)
                ->where('hidden', false)
                ->groupBy('thread_id')
                ->selectRaw('thread_id, count(*) as total')
                ->pluck('total', 'thread_id');

        $threads = $rawThreads->map(fn ($t) => [
            'id' => (int) $t->id,
            'title' => $t->title,
            'forum_slug' => $t->forum_slug,
            'forum_name' => $t->forum_name,
            'reply_count' => (int) ($replyCounts[$t->id] ?? 0),
            'accepted_reply_id' => $t->accepted_reply_id ? (int) $t->accepted_reply_id : null,
            'created_at' => $this->toIso($t->created_at),
        ])->values();

        $rawReplies = DB::table('community_replies as r')
            ->join('community_threads as t', 't.id', '=', 'r.thread_id')
            ->join('community_forums as f', 'f.id', '=', 't.forum_id')
            ->whereNull('t.group_id')
            ->where('r.author_id', $id)
            ->where('r.hidden', false)
            ->where('t.hidden', false)
            ->where('f.is_active', true)
            ->orderByDesc('r.created_at')
            ->limit(25)
            ->get([
                'r.id',
                'r.thread_id',
                't.title as thread_title',
                't.accepted_reply_id',
                'f.name as forum_name',
                'r.body',
                'r.created_at',
            ]);

        $replyIds = $rawReplies->pluck('id');
        $voteCounts = $replyIds->isEmpty()
            ? collect()
            : DB::table('community_reply_votes')
                ->whereIn('reply_id', $replyIds)
                ->groupBy('reply_id')
                ->selectRaw('reply_id, count(*) as total')
                ->pluck('total', 'reply_id');

        $replies = $rawReplies->map(fn ($r) => [
            'id' => (int) $r->id,
            'thread_id' => (int) $r->thread_id,
            'thread_title' => $r->thread_title,
            'forum_name' => $r->forum_name,
            'body' => Str::limit($r->body, 220),
            'votes_count' => (int) ($voteCounts[$r->id] ?? 0),
            'is_solution' => (int) ($r->accepted_reply_id ?? 0) === (int) $r->id,
            'created_at' => $this->toIso($r->created_at),
        ])->values();

        $kindPaths = [
            'article' => '/publications/blogs',
            'story' => '/publications/stories',
            'business' => '/marketplace',
            'event' => '/events',
            'publication' => '/publications/reports',
            'resource' => '/resources',
        ];

        $comments = DB::table('editorial_comments as c')
            ->join('editorial_content as e', 'e.content_id', '=', 'c.content_id')
            ->where('c.user_id', $id)
            ->where('c.hidden', false)
            ->where('e.status', 'published')
            ->orderByDesc('c.created_at')
            ->limit(25)
            ->get(['c.id', 'c.content_id', 'c.body', 'c.created_at', 'e.kind', 'e.slug', 'e.payload'])
            ->map(function ($row) use ($kindPaths) {
                $decoded = json_decode($row->payload, true);
                $basePath = $kindPaths[$row->kind] ?? '/publications/blogs';

                return [
                    'id' => (int) $row->id,
                    'content_id' => $row->content_id,
                    'article_title' => (string) ($decoded['title'] ?? 'Article'),
                    'href' => $basePath.'/'.rawurlencode($row->slug).'#comment-'.$row->id,
                    'body' => Str::limit($row->body, 220),
                    'created_at' => $this->toIso($row->created_at),
                ];
            })
            ->values();

        $ventures = DB::table('ventures')
            ->where('owner_id', $id)
            ->where('status', 'approved')
            ->orderBy('name')
            ->get(['id', 'name', 'sector', 'location'])
            ->map(fn ($v) => [
                'id' => (int) $v->id,
                'name' => $v->name,
                'sector' => $v->sector,
                'location' => $v->location,
            ])
            ->values();

        $monthBoard = $this->computeLeaderboard('month');
        $allBoard = $this->computeLeaderboard('all');

        $totalThreads = DB::table('community_threads as t')
            ->whereNull('t.group_id')
            ->where('t.author_id', $id)
            ->where('t.hidden', false)
            ->count();

        $totalReplies = DB::table('community_replies as r')
            ->join('community_threads as t', 't.id', '=', 'r.thread_id')
            ->whereNull('t.group_id')
            ->where('r.author_id', $id)
            ->where('r.hidden', false)
            ->where('t.hidden', false)
            ->count();

        $totalComments = DB::table('editorial_comments as c')
            ->join('editorial_content as e', 'e.content_id', '=', 'c.content_id')
            ->where('c.user_id', $id)
            ->where('c.hidden', false)
            ->where('e.status', 'published')
            ->count();

        $solutionsCount = DB::table('community_threads as t')
            ->join('community_replies as r', 'r.id', '=', 't.accepted_reply_id')
            ->where('t.hidden', false)
            ->where('r.hidden', false)
            ->where('r.author_id', $id)
            ->count();

        $helpfulVotesReceived = DB::table('community_reply_votes as v')
            ->join('community_replies as r', 'r.id', '=', 'v.reply_id')
            ->where('r.hidden', false)
            ->where('r.author_id', $id)
            ->count();

        $activity = collect()
            ->merge($threads->map(fn ($t) => [
                'id' => 'thread-'.$t['id'],
                'kind' => 'thread',
                'title' => $t['title'],
                'summary' => 'Started discussion in '.$t['forum_name'],
                'href' => '/forums/'.$t['id'],
                'created_at' => $t['created_at'],
            ]))
            ->merge($replies->map(fn ($r) => [
                'id' => 'reply-'.$r['id'],
                'kind' => 'reply',
                'title' => $r['thread_title'],
                'summary' => $r['body'],
                'href' => '/forums/'.$r['thread_id'].'#reply-'.$r['id'],
                'created_at' => $r['created_at'],
            ]))
            ->merge($comments->map(fn ($c) => [
                'id' => 'comment-'.$c['id'],
                'kind' => 'comment',
                'title' => $c['article_title'],
                'summary' => $c['body'],
                'href' => $c['href'],
                'created_at' => $c['created_at'],
            ]))
            ->merge($groups->map(fn ($g) => [
                'id' => 'group-'.$g['id'],
                'kind' => 'group',
                'title' => $g['name'],
                'summary' => 'Joined '.$g['category'].' circle',
                'href' => '/groups/'.rawurlencode($g['slug']),
                'created_at' => $g['joined_at'],
            ]))
            ->sortByDesc('created_at')
            ->take(25)
            ->values();

        return response()->json([
            'data' => [
                'member' => [
                    'id' => (int) $user->id,
                    'name' => $user->name,
                    'role' => $user->role,
                    'avatar' => $user->avatar,
                    'location' => $user->location,
                    'headline' => $user->headline,
                    'bio' => $user->bio,
                    'institution' => $institution ? [
                        'name' => $institution->name,
                        'slug' => $institution->slug,
                        'kind' => $institution->kind,
                    ] : null,
                    'joined_at' => $this->toIso($user->created_at),
                ],
                'stats' => [
                    'groups_count' => $groups->count(),
                    'threads_count' => $totalThreads,
                    'replies_count' => $totalReplies,
                    'comments_count' => $totalComments,
                    'solutions_count' => $solutionsCount,
                    'helpful_votes_received' => $helpfulVotesReceived,
                ],
                'leaderboard' => [
                    'month' => collect($monthBoard['ranked'])->firstWhere('user_id', $id),
                    'all' => collect($allBoard['ranked'])->firstWhere('user_id', $id),
                ],
                'groups' => $groups,
                'threads' => $threads,
                'replies' => $replies,
                'comments' => $comments,
                'ventures' => $ventures,
                'activity' => $activity,
            ],
        ])->header('Cache-Control', 'no-store');
    }

    /**
     * @return array{rules: array<string, int>, ranked: array<int, array<string, mixed>>}
     */
    private function computeLeaderboard(string $period): array
    {
        $cutoff = $period === 'month'
            ? CarbonImmutable::now('Africa/Nairobi')->startOfMonth()->utc()->format('Y-m-d H:i:s')
            : null;

        $rules = [
            'course' => 30,
            'stage' => 20,
            'solution' => 15,
            'event' => 10,
            'topic' => 5,
            'helpful_vote' => 3,
            'reply' => 2,
        ];

        $courses = DB::table('learning_enrolments')
            ->whereNotNull('completed_at')
            ->when($cutoff, fn ($q) => $q->where('completed_at', '>=', $cutoff))
            ->groupBy('learner_id')
            ->selectRaw('learner_id as uid, count(*) as cnt')
            ->pluck('cnt', 'uid');

        $stages = DB::table('incubation_stages as s')
            ->join('incubation_paths as p', 'p.id', '=', 's.path_id')
            ->join('ventures as v', 'v.id', '=', 'p.venture_id')
            ->whereNotNull('s.graded_at')
            ->where(function ($q): void {
                $q->where('s.passed', true)
                    ->orWhere(function ($fb): void {
                        $fb->whereNull('s.passed')->where('s.score', '>=', Curriculum::PASS_MARK);
                    });
            })
            ->when($cutoff, fn ($q) => $q->where('s.graded_at', '>=', $cutoff))
            ->groupBy('v.owner_id')
            ->selectRaw('v.owner_id as uid, count(*) as cnt')
            ->pluck('cnt', 'uid');

        $solutions = DB::table('community_threads as t')
            ->join('community_replies as r', 'r.id', '=', 't.accepted_reply_id')
            ->where('t.hidden', false)
            ->where('r.hidden', false)
            ->when($cutoff, fn ($q) => $q->where('r.created_at', '>=', $cutoff))
            ->groupBy('r.author_id')
            ->selectRaw('r.author_id as uid, count(*) as cnt')
            ->pluck('cnt', 'uid');

        $events = DB::table('event_bookings')
            ->when($cutoff, fn ($q) => $q->where('created_at', '>=', $cutoff))
            ->groupBy('user_id')
            ->selectRaw('user_id as uid, count(*) as cnt')
            ->pluck('cnt', 'uid');

        $topics = DB::table('community_threads')
            ->where('hidden', false)
            ->when($cutoff, fn ($q) => $q->where('created_at', '>=', $cutoff))
            ->groupBy('author_id')
            ->selectRaw('author_id as uid, count(*) as cnt')
            ->pluck('cnt', 'uid');

        $replies = DB::table('community_replies')
            ->where('hidden', false)
            ->when($cutoff, fn ($q) => $q->where('created_at', '>=', $cutoff))
            ->groupBy('author_id')
            ->selectRaw('author_id as uid, count(*) as cnt')
            ->pluck('cnt', 'uid');

        $votes = DB::table('community_reply_votes as v')
            ->join('community_replies as r', 'r.id', '=', 'v.reply_id')
            ->where('r.hidden', false)
            ->when($cutoff, fn ($q) => $q->where('v.created_at', '>=', $cutoff))
            ->groupBy('r.author_id')
            ->selectRaw('r.author_id as uid, count(*) as cnt')
            ->pluck('cnt', 'uid');

        $members = DB::table('users')
            ->whereNull('suspended_at')
            ->whereNotNull('email_verified_at')
            ->get(['id', 'name', 'role']);

        $staffUserIds = array_flip(
            DB::table('institution_access')
                ->pluck('user_id')
                ->all()
        );

        $rows = $members->filter(function ($m) use ($staffUserIds): bool {
            return $m->role !== 'guest' || isset($staffUserIds[$m->id]);
        })->map(function ($m) use ($courses, $stages, $solutions, $events, $topics, $replies, $votes, $rules) {
            $uid = $m->id;
            $breakdown = [
                'courses' => (int) ($courses[$uid] ?? 0),
                'stages' => (int) ($stages[$uid] ?? 0),
                'solutions' => (int) ($solutions[$uid] ?? 0),
                'events' => (int) ($events[$uid] ?? 0),
                'topics' => (int) ($topics[$uid] ?? 0),
                'votes' => (int) ($votes[$uid] ?? 0),
                'replies' => (int) ($replies[$uid] ?? 0),
            ];
            $points = ($breakdown['courses'] * $rules['course'])
                + ($breakdown['stages'] * $rules['stage'])
                + ($breakdown['solutions'] * $rules['solution'])
                + ($breakdown['events'] * $rules['event'])
                + ($breakdown['topics'] * $rules['topic'])
                + ($breakdown['votes'] * $rules['helpful_vote'])
                + ($breakdown['replies'] * $rules['reply']);

            return [
                'user_id' => (int) $m->id,
                'name' => $m->name,
                'role' => $m->role,
                'points' => $points,
                'breakdown' => $breakdown,
            ];
        })->sort(function (array $a, array $b): int {
            if ($a['points'] !== $b['points']) {
                return $b['points'] <=> $a['points'];
            }
            $nameCmp = strcmp($a['name'], $b['name']);

            return $nameCmp !== 0 ? $nameCmp : ($a['user_id'] <=> $b['user_id']);
        })->values();

        $ranked = [];
        $prevPoints = null;
        $currentRank = 0;
        foreach ($rows as $index => $entry) {
            if ($prevPoints === null || $entry['points'] !== $prevPoints) {
                $currentRank = $index + 1;
                $prevPoints = $entry['points'];
            }
            $ranked[] = [
                ...$entry,
                'rank' => $currentRank,
                'position' => $index + 1,
            ];
        }

        return [
            'rules' => $rules,
            'ranked' => $ranked,
        ];
    }

    public function saveForum(Request $request, ?int $id = null): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->isModerator($user), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:120'],
            'description' => ['required', 'string', 'min:5', 'max:500'],
            'position' => ['nullable', 'integer', 'between:0,1000'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $now = now();
        if ($id === null) {
            $slugBase = Str::slug(Str::limit($data['name'], 100, '')) ?: 'forum';
            $slug = $slugBase;
            while (DB::table('community_forums')->where('slug', $slug)->exists()) {
                $slug = $slugBase.'-'.Str::lower(Str::random(4));
            }
            $id = DB::table('community_forums')->insertGetId([
                'slug' => $slug,
                'name' => trim($data['name']),
                'description' => trim($data['description']),
                'position' => (int) ($data['position'] ?? 0),
                'is_active' => array_key_exists('is_active', $data) ? (bool) $data['is_active'] : true,
                'created_by' => $user->id,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        } else {
            abort_unless(DB::table('community_forums')->where('id', $id)->exists(), 404);
            DB::table('community_forums')->where('id', $id)->update([
                'name' => trim($data['name']),
                'description' => trim($data['description']),
                'position' => (int) ($data['position'] ?? 0),
                'is_active' => array_key_exists('is_active', $data) ? (bool) $data['is_active'] : true,
                'updated_at' => $now,
            ]);
        }

        return response()->json(['data' => ['id' => $id]]);
    }

    public function saveGroup(Request $request, ?int $id = null): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->isModerator($user), 403, 'Only administrators and content managers can manage groups.');

        $data = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:120'],
            'category' => ['required', 'string', 'min:2', 'max:80'],
            'description' => ['required', 'string', 'min:5', 'max:1000'],
            'is_active' => ['sometimes', 'boolean'],
            'whatsapp_url' => [
                'nullable',
                'string',
                'max:500',
                function (string $attribute, mixed $value, Closure $fail): void {
                    if ($value === null || trim((string) $value) === '') {
                        return;
                    }
                    $trimmed = trim((string) $value);
                    $scheme = strtolower((string) parse_url($trimmed, PHP_URL_SCHEME));
                    $host = strtolower((string) parse_url($trimmed, PHP_URL_HOST));
                    $allowedHosts = ['chat.whatsapp.com', 'wa.me', 'whatsapp.com', 'www.whatsapp.com', 'api.whatsapp.com'];
                    if ($scheme !== 'https' || ! in_array($host, $allowedHosts, true) || ! filter_var($trimmed, FILTER_VALIDATE_URL)) {
                        $fail('Enter a valid https:// WhatsApp invite URL (e.g. https://chat.whatsapp.com/...).');
                    }
                },
            ],
        ]);

        $whatsappUrl = isset($data['whatsapp_url']) && trim((string) $data['whatsapp_url']) !== ''
            ? trim((string) $data['whatsapp_url'])
            : null;
        $now = now();

        if ($id === null) {
            $slugBase = Str::slug(Str::limit($data['name'], 100, '')) ?: 'group';
            $slug = $slugBase;
            while (DB::table('community_groups')->where('slug', $slug)->exists()) {
                $slug = $slugBase.'-'.Str::lower(Str::random(4));
            }
            $id = DB::table('community_groups')->insertGetId([
                'slug' => $slug,
                'name' => trim($data['name']),
                'category' => trim($data['category']),
                'description' => trim($data['description']),
                'whatsapp_url' => $whatsappUrl,
                'is_active' => array_key_exists('is_active', $data) ? (bool) $data['is_active'] : true,
                'created_by' => $user->id,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        } else {
            abort_unless(DB::table('community_groups')->where('id', $id)->exists(), 404);
            DB::table('community_groups')->where('id', $id)->update([
                'name' => trim($data['name']),
                'category' => trim($data['category']),
                'description' => trim($data['description']),
                'whatsapp_url' => $whatsappUrl,
                'is_active' => array_key_exists('is_active', $data) ? (bool) $data['is_active'] : true,
                'updated_at' => $now,
            ]);
        }

        return response()->json(['data' => ['id' => $id]]);
    }

    public function moderation(Request $request): JsonResponse
    {
        abort_unless($this->isModerator($request->user()), 403);

        $forums = DB::table('community_forums')
            ->orderBy('position')
            ->orderBy('name')
            ->get()
            ->map(fn ($f) => [
                'id' => (int) $f->id,
                'slug' => $f->slug,
                'name' => $f->name,
                'description' => $f->description,
                'position' => (int) $f->position,
                'is_active' => (bool) $f->is_active,
            ])
            ->values();

        $threads = DB::table('community_threads as t')
            ->leftJoin('community_forums as f', 'f.id', '=', 't.forum_id')
            ->leftJoin('community_groups as g', 'g.id', '=', 't.group_id')
            ->join('users as author', 'author.id', '=', 't.author_id')
            ->orderByDesc('t.created_at')
            ->limit(100)
            ->get([
                't.id',
                't.title',
                't.body',
                't.pinned',
                't.locked',
                't.hidden',
                't.created_at',
                'f.name as forum_name',
                'g.name as group_name',
                'author.name as author_name',
                'author.role as author_role',
            ])
            ->map(fn ($row) => [
                'id' => (int) $row->id,
                'title' => $row->title,
                'body' => Str::limit($row->body, 220),
                'context' => $row->group_name ? 'Group: '.$row->group_name : ('Forum: '.($row->forum_name ?? 'Public')),
                'author_name' => $row->author_name,
                'author_role' => $row->author_role,
                'pinned' => (bool) $row->pinned,
                'locked' => (bool) $row->locked,
                'hidden' => (bool) $row->hidden,
                'created_at' => $this->toIso($row->created_at),
            ])
            ->values();

        $replies = DB::table('community_replies as r')
            ->join('community_threads as t', 't.id', '=', 'r.thread_id')
            ->join('users as author', 'author.id', '=', 'r.author_id')
            ->orderByDesc('r.created_at')
            ->limit(100)
            ->get([
                'r.id',
                'r.thread_id',
                'r.body',
                'r.hidden',
                'r.created_at',
                't.title as thread_title',
                'author.name as author_name',
                'author.role as author_role',
            ])
            ->map(fn ($row) => [
                'id' => (int) $row->id,
                'thread_id' => (int) $row->thread_id,
                'thread_title' => $row->thread_title,
                'body' => Str::limit($row->body, 220),
                'author_name' => $row->author_name,
                'author_role' => $row->author_role,
                'hidden' => (bool) $row->hidden,
                'created_at' => $this->toIso($row->created_at),
            ])
            ->values();

        $titles = DB::table('editorial_content')->get(['content_id', 'payload'])->mapWithKeys(function ($row) {
            $decoded = json_decode($row->payload, true);

            return [$row->content_id => (string) ($decoded['title'] ?? $row->content_id)];
        });

        $comments = DB::table('editorial_comments as c')
            ->join('users as author', 'author.id', '=', 'c.user_id')
            ->orderByDesc('c.created_at')
            ->limit(100)
            ->get([
                'c.id',
                'c.content_id',
                'c.body',
                'c.hidden',
                'c.created_at',
                'author.name as author_name',
                'author.role as author_role',
            ])
            ->map(fn ($row) => [
                'id' => (int) $row->id,
                'content_id' => $row->content_id,
                'article_title' => $titles[$row->content_id] ?? $row->content_id,
                'body' => Str::limit($row->body, 220),
                'author_name' => $row->author_name,
                'author_role' => $row->author_role,
                'hidden' => (bool) $row->hidden,
                'created_at' => $this->toIso($row->created_at),
            ])
            ->values();

        return response()->json([
            'data' => compact('forums', 'threads', 'replies', 'comments'),
        ])->header('Cache-Control', 'no-store');
    }

    public function moderateThread(Request $request, int $id): JsonResponse
    {
        abort_unless($this->isModerator($request->user()), 403);
        abort_unless(DB::table('community_threads')->where('id', $id)->exists(), 404);

        $data = $request->validate([
            'hidden' => ['sometimes', 'boolean'],
            'pinned' => ['sometimes', 'boolean'],
            'locked' => ['sometimes', 'boolean'],
        ]);

        $updates = ['updated_at' => now()];
        foreach (['hidden', 'pinned', 'locked'] as $flag) {
            if (array_key_exists($flag, $data)) {
                $updates[$flag] = (bool) $data[$flag];
            }
        }
        DB::table('community_threads')->where('id', $id)->update($updates);

        return response()->json(['data' => ['saved' => true]]);
    }

    public function moderateReply(Request $request, int $id): JsonResponse
    {
        abort_unless($this->isModerator($request->user()), 403);
        abort_unless(DB::table('community_replies')->where('id', $id)->exists(), 404);

        $data = $request->validate(['hidden' => ['required', 'boolean']]);
        DB::table('community_replies')->where('id', $id)->update([
            'hidden' => (bool) $data['hidden'],
            'updated_at' => now(),
        ]);

        return response()->json(['data' => ['saved' => true]]);
    }

    public function moderateComment(Request $request, int $id): JsonResponse
    {
        abort_unless($this->isModerator($request->user()), 403);
        abort_unless(DB::table('editorial_comments')->where('id', $id)->exists(), 404);

        $data = $request->validate(['hidden' => ['required', 'boolean']]);
        DB::table('editorial_comments')->where('id', $id)->update([
            'hidden' => (bool) $data['hidden'],
            'updated_at' => now(),
        ]);

        return response()->json(['data' => ['saved' => true]]);
    }

    private function isModerator(?User $user): bool
    {
        return $user !== null
            && $user->isActive()
            && $user->hasVerifiedEmail()
            && in_array($user->role, ['admin', 'content_manager'], true);
    }

    private function requireDashboardMember(User $user): void
    {
        if ($user->role !== 'guest') {
            return;
        }
        $isStaff = DB::table('institution_access')->where('user_id', $user->id)->exists();
        abort_unless($isStaff, 403, 'The leaderboard is available inside member dashboards only.');
    }

    private function toIso(mixed $timestamp): string
    {
        return Publishing::time($timestamp ? (string) $timestamp : null, true)
            ? CarbonImmutable::parse((string) $timestamp, 'UTC')->toIso8601String()
            : now()->toIso8601String();
    }

    private function nairobiDay(string $iso): string
    {
        return CarbonImmutable::parse($iso)->setTimezone('Africa/Nairobi')->format('Y-m-d');
    }
}
