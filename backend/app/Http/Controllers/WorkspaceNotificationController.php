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
        $items = $account->notifications()->where('type', 'course-certificate-issued')->limit(50)->get()
            ->map(fn ($record) => [
                'id' => $record->id,
                'message' => 'Your certificate for '.$record->data['courseName'].' is ready.',
                'url' => parse_url($record->data['url'], PHP_URL_PATH),
                'read' => $record->read_at !== null,
                'received_at' => $record->created_at->toIso8601String(),
            ]);
        $unread = $account->unreadNotifications()->where('type', 'course-certificate-issued')->count();

        return response()->json(['data' => compact('items', 'unread')])->header('Cache-Control', 'private, no-store');
    }

    public function read(Request $request, string $id): Response
    {
        $record = $request->user()->notifications()->where('type', 'course-certificate-issued')
            ->findOrFail($id);
        $record->markAsRead();

        return response()->noContent();
    }
}
