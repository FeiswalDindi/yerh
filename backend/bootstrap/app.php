<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Routing\Exceptions\InvalidSignatureException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->appendToGroup('web', \App\Http\Middleware\RecordWorkspaceActivity::class);
        $middleware->convertEmptyStringsToNull(except: [
            fn (Request $request): bool => $request->is('api/v1/workspace/cms/*')
                && ! $request->is('api/v1/workspace/cms/media*'),
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->render(function (InvalidSignatureException $exception, Request $request) {
            if ($request->routeIs('verification.verify') && ! $request->expectsJson()) {
                return redirect('/account?verification=invalid', headers: [
                    'Cache-Control' => 'no-store',
                    'Referrer-Policy' => 'no-referrer',
                ]);
            }
        });
    })->create();
