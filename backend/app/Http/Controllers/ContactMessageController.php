<?php

namespace App\Http\Controllers;

use App\Support\WorkspaceNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

final class ContactMessageController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'email' => ['required', 'email', 'max:254'],
            'topic' => ['required', 'string', 'min:2', 'max:100'],
            'message' => ['required', 'string', 'min:10', 'max:2000'],
        ]);

        $name = trim($data['name']);
        $topic = trim($data['topic']);

        $email = Str::lower(trim($data['email']));

        $id = DB::table('contact_messages')->insertGetId([
            'name' => $name,
            'email' => $email,
            'topic' => $topic,
            'message' => trim($data['message']),
            'status' => 'new',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        WorkspaceNotifier::notifyContentTeam(
            "New {$topic} enquiry from {$name} ({$email}).",
            '/dashboard/workspace?tab=communications',
            "New {$topic} enquiry from {$name}",
            'Open Communications Hub',
        );

        WorkspaceNotifier::notifyExternalEmail(
            $email,
            $name,
            "We received your enquiry: {$topic}",
            "Thank you for contacting Youth Entrepreneurship Resource Hub regarding \"{$topic}\".\n\nOur team has received your message and will reply to this email address shortly.",
            'Visit YERH',
            '/',
        );

        return response()->json(['data' => ['id' => $id]], 201);
    }

    public function index(Request $request): JsonResponse
    {
        abort_unless(in_array($request->user()->role, ['admin', 'content_manager'], true), 403);

        $rows = DB::table('contact_messages as msg')
            ->leftJoin('users as handler', 'handler.id', '=', 'msg.handled_by')
            ->select(
                'msg.id',
                'msg.name',
                'msg.email',
                'msg.topic',
                'msg.message',
                'msg.status',
                'msg.admin_notes',
                'handler.name as handler_name',
                'msg.handled_at',
                'msg.reply_count',
                'msg.replied_at',
                'msg.created_at',
            )
            ->orderByRaw("CASE WHEN msg.status = 'new' THEN 0 WHEN msg.status = 'read' THEN 1 ELSE 2 END")
            ->orderByDesc('msg.id')
            ->get();

        return response()->json(['data' => $rows])->header('Cache-Control', 'private, no-store');
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $actor = $request->user();
        abort_unless(in_array($actor->role, ['admin', 'content_manager'], true), 403);

        $data = $request->validate([
            'status' => ['required', Rule::in(['new', 'read', 'resolved'])],
            'admin_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $existing = DB::table('contact_messages')->where('id', $id)->first(['id', 'admin_notes']) ?? abort(404);
        $notes = $request->exists('admin_notes')
            ? (isset($data['admin_notes']) && trim($data['admin_notes']) !== '' ? trim($data['admin_notes']) : null)
            : $existing->admin_notes;

        DB::table('contact_messages')->where('id', $id)->update([
            'status' => $data['status'],
            'admin_notes' => $notes,
            'handled_by' => $actor->id,
            'handled_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['data' => ['id' => $id, 'status' => $data['status']]]);
    }
}
