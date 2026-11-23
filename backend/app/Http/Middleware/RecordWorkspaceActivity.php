<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

final class RecordWorkspaceActivity
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->isMethodSafe() || ! $request->is('api/v1/workspace/*', 'api/v1/identity/*', 'api/v1/learning/*', 'api/v1/engagement/*')) {
            return $next($request);
        }

        // Record the operation in the same transaction as its underlying changes.
        return DB::transaction(function () use ($request, $next) {
            $response = $next($request);
            if ($response->isSuccessful() && $request->user()) {
                $handler = $request->route()->getActionMethod();
                DB::table('workspace_activity')->insert([
                    'actor_id' => $request->user()->id,
                    'action' => Str::headline($handler),
                    'target' => Str::limit(Str::after($request->path(), 'api/v1/'), 500),
                    'created_at' => now(),
                ]);
            }

            return $response;
        });
    }
}
