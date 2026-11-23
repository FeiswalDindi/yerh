<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{ $title }}</title>
<style>
    body { margin: 0 auto; max-width: 46rem; padding: 2rem; font: 1rem/1.5 system-ui, sans-serif; color: #192c57; }
    article { border: 3px double #192c57; padding: 2.5rem; text-align: center; }
    ul { display: inline-block; text-align: left; }
    footer { margin-top: 1.5rem; font-size: .8rem; overflow-wrap: anywhere; }
    button { margin-top: 1rem; padding: 0.65rem 1rem; }
    @media print { body { padding: 0; } article { break-inside: avoid; } button { display: none; } }
</style>
<main>
    <article>
        <p>YOUTH ENTREPRENEURSHIP RESOURCE HUB</p>
        <h1>{{ $title }}</h1>
        <p>Presented to</p>
        <h2>{{ $record->recipient }}</h2>
        <p>{{ $record->citation ?? 'For completing the required assessments for '.$record->venture.'.' }}</p>
        <h3>Achievements</h3>
        <ul>
            @foreach ($achievements as $achievement)
                <li>{{ $achievement }}</li>
            @endforeach
        </ul>
        <footer>Issued {{ \Illuminate\Support\Carbon::parse($record->issued_at)->format('j F Y') }} · {{ $record->document_id }}</footer>
    </article>
    <button type="button" onclick="print()">Print or save PDF</button>
</main>
</html>
