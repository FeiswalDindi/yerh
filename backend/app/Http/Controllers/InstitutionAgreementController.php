<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

final class InstitutionAgreementController extends Controller
{
    public function index(Request $request, string $slug): JsonResponse
    {
        $institution = $this->institution($request, $slug);
        $items = DB::table('institution_agreement_documents')->where('institution_id', $institution->id)
            ->latest('id')->get(['id', 'reference', 'created_at']);

        return response()->json(['data' => $items])->header('Cache-Control', 'private, no-store');
    }

    public function store(Request $request, string $slug): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        $institution = $this->institution($request, $slug);
        $data = $request->validate([
            'reference' => ['required', 'string', 'max:180'],
            'document' => ['required', 'file', 'mimes:pdf', 'max:10240'],
        ]);
        $path = $request->file('document')->store('institution-agreements', 'local');
        abort_if($path === false, 500, 'The agreement could not be saved.');
        try {
            $id = DB::table('institution_agreement_documents')->insertGetId([
                'institution_id' => $institution->id, 'uploaded_by' => $request->user()->id,
                'reference' => $data['reference'], 'path' => $path, 'created_at' => now(),
            ]);
        } catch (Throwable $exception) {
            Storage::disk('local')->delete($path);
            throw $exception;
        }

        return response()->json(['data' => ['id' => $id]], 201);
    }

    public function download(Request $request, string $slug, int $id): StreamedResponse
    {
        $institution = $this->institution($request, $slug);
        $path = DB::table('institution_agreement_documents')->where('institution_id', $institution->id)
            ->where('id', $id)->value('path') ?? abort(404);
        abort_unless(Storage::disk('local')->exists($path), 404);

        return Storage::disk('local')->download($path, 'agreement-'.$institution->slug.'.pdf', [
            'Cache-Control' => 'private, no-store',
        ]);
    }

    private function institution(Request $request, string $slug): object
    {
        $institution = DB::table('institutions')->where('slug', $slug)->first() ?? abort(404);
        $user = $request->user();
        if ($user->role !== 'admin') {
            abort_unless($institution->status === 'active' && DB::table('institution_access')
                ->where('institution_id', $institution->id)->where('user_id', $user->id)->exists(), 403);
        }

        return $institution;
    }
}
