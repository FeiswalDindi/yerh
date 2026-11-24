<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class WorkspaceNotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $account = $request->user();
        $items = $account->notifications()->limit(50)->get()
            ->map(function ($record) {
                $data = is_array($record->data) ? $record->data : [];
                $message = $record->type === 'course-certificate-issued'
                    ? 'Your certificate for '.($data['courseName'] ?? 'your course').' is ready.'
                    : (string) ($data['message'] ?? 'Workspace update');
                $rawUrl = (string) ($data['url'] ?? '/dashboard');
                $path = parse_url($rawUrl, PHP_URL_PATH) ?: '/dashboard';
                $query = parse_url($rawUrl, PHP_URL_QUERY);

                return [
                    'id' => $record->id,
                    'type' => $record->type,
                    'message' => $message,
                    'url' => $query ? $path.'?'.$query : $path,
                    'read' => $record->read_at !== null,
                    'received_at' => $record->created_at->toIso8601String(),
                ];
            });
        $unread = $account->unreadNotifications()->count();

        return response()->json(['data' => compact('items', 'unread')])->header('Cache-Control', 'private, no-store');
    }

    public function read(Request $request, string $id): Response
    {
        $record = $request->user()->notifications()->findOrFail($id);
        $record->markAsRead();

        return response()->noContent();
    }

    public function readAll(Request $request): Response
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return response()->noContent();
    }
}
