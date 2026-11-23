<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class VerifiedWorkspaceAccount
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless($request->user()?->isActive(), 403, 'This account is unavailable.');
        abort_unless($request->user()->hasVerifiedEmail(), 403, 'Verify your email first.');

        return $next($request);
    }
}
