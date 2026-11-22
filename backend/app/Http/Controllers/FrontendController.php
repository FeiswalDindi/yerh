<?php

namespace App\Http\Controllers;

use Symfony\Component\HttpFoundation\BinaryFileResponse;

final class FrontendController extends Controller
{
    public function __invoke(): BinaryFileResponse
    {
        $entry = public_path('ui/index.html');

        abort_unless(is_file($entry), 503, 'Build the React UI with npm run build:laravel.');

        return response()->file($entry, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Cache-Control' => 'no-cache',
        ]);
    }
}
