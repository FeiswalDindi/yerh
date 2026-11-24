<?php

declare(strict_types=1);

/**
 * Generates WebP siblings for bundled raster images in frontend/public/media,
 * compacts oversized institution-sign-in.webp, writes INLINE_YERH_LOGO,
 * and emits media-variants.ts with WebP mappings and natural dimensions.
 */
$frontendDir = dirname(__DIR__);
$mediaDir = $frontendDir . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'media';
$configDir = $frontendDir . DIRECTORY_SEPARATOR . 'src' . DIRECTORY_SEPARATOR . 'config';

if (! is_dir($mediaDir)) {
    fwrite(STDERR, "Missing media directory: {$mediaDir}\n");
    exit(1);
}

if (! extension_loaded('gd') || ! function_exists('imagewebp')) {
    fwrite(STDERR, "PHP GD with WebP support is required.\n");
    exit(1);
}

function loadGdImage(string $path, int $imageType): ?GdImage
{
    $image = match ($imageType) {
        IMAGETYPE_JPEG => @imagecreatefromjpeg($path),
        IMAGETYPE_PNG => @imagecreatefrompng($path),
        IMAGETYPE_WEBP => @imagecreatefromwebp($path),
        default => false,
    };

    if (! $image instanceof GdImage) {
        return null;
    }

    if ($imageType === IMAGETYPE_JPEG && function_exists('exif_read_data')) {
        $exif = @exif_read_data($path);
        $orientation = (int) ($exif['Orientation'] ?? 1);
        $angle = match ($orientation) {
            3 => 180,
            6 => -90,
            8 => 90,
            default => 0,
        };
        if ($angle !== 0) {
            $rotated = @imagerotate($image, $angle, 0);
            if ($rotated instanceof GdImage) {
                imagedestroy($image);
                $image = $rotated;
            }
        }
    }

    if (function_exists('imagepalettetotruecolor') && ! imageistruecolor($image)) {
        @imagepalettetotruecolor($image);
    }

    imagealphablending($image, false);
    imagesavealpha($image, true);

    return $image;
}

function hasHighDetailLogoQuality(string $relPath): bool
{
    $name = basename($relPath);

    return $name === 'yerh-wordmark.png'
        || $name === 'kca-university-logo-f7590b5e.png'
        || str_starts_with($name, 'british-council-')
        || str_starts_with($name, 'yerh-logo');
}

// 1. Compact institution-sign-in.webp to <= 640x640 WebP if smaller
$institutionPath = $mediaDir . DIRECTORY_SEPARATOR . 'institution-sign-in.webp';
if (is_file($institutionPath)) {
    $info = @getimagesize($institutionPath);
    if ($info && ($info[0] > 640 || $info[1] > 640)) {
        $srcImg = loadGdImage($institutionPath, (int) $info[2]);
        if ($srcImg instanceof GdImage) {
            $targetW = 640;
            $targetH = (int) round(($info[1] / $info[0]) * $targetW);
            $dstImg = imagecreatetruecolor($targetW, $targetH);
            imagealphablending($dstImg, false);
            imagesavealpha($dstImg, true);
            $transparent = imagecolorallocatealpha($dstImg, 0, 0, 0, 127);
            imagefilledrectangle($dstImg, 0, 0, $targetW, $targetH, $transparent);
            imagecopyresampled($dstImg, $srcImg, 0, 0, 0, 0, $targetW, $targetH, $info[0], $info[1]);

            $tmp = $institutionPath . '.tmp.webp';
            $ok = imagewebp($dstImg, $tmp, 80);
            imagedestroy($dstImg);
            imagedestroy($srcImg);

            if ($ok && is_file($tmp)) {
                if (filesize($tmp) < filesize($institutionPath)) {
                    rename($tmp, $institutionPath);
                    echo "Compacted institution-sign-in.webp -> " . round(filesize($institutionPath) / 1024, 1) . " KB\n";
                } else {
                    @unlink($tmp);
                }
            }
        }
    }
}

// 2. Collect all source raster files first (avoid iterating newly created .webp twice)
$iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($mediaDir));
$files = [];
foreach ($iterator as $fileInfo) {
    if ($fileInfo->isFile()) {
        $files[] = $fileInfo->getPathname();
    }
}
sort($files);

$createdCount = 0;
$skippedLarger = 0;

foreach ($files as $absPath) {
    $ext = strtolower(pathinfo($absPath, PATHINFO_EXTENSION));
    if (! in_array($ext, ['jpg', 'jpeg', 'png'], true)) {
        continue;
    }

    $info = @getimagesize($absPath);
    if (! $info) {
        continue;
    }

    $imageType = (int) $info[2];
    if (! in_array($imageType, [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) {
        continue;
    }

    $relUnix = str_replace('\\', '/', substr($absPath, strlen($mediaDir) + 1));
    $webpPath = preg_replace('/\.(jpe?g|png)$/i', '.webp', $absPath);
    $srcSize = filesize($absPath);

    // Preserve pre-existing smaller WebP siblings (e.g., be-part-of-the-team-3382b8d1.webp).
    if (is_file($webpPath) && filesize($webpPath) < $srcSize) {
        continue;
    }

    $gdImage = loadGdImage($absPath, $imageType);
    if (! $gdImage instanceof GdImage) {
        continue;
    }

    $quality = hasHighDetailLogoQuality($relUnix) ? 90 : 80;
    $tmpPath = $webpPath . '.tmp.webp';
    $encoded = imagewebp($gdImage, $tmpPath, $quality);
    imagedestroy($gdImage);

    if (! $encoded || ! is_file($tmpPath)) {
        @unlink($tmpPath);
        continue;
    }

    $newSize = filesize($tmpPath);
    if ($newSize < $srcSize && (! is_file($webpPath) || $newSize < filesize($webpPath))) {
        rename($tmpPath, $webpPath);
        $createdCount++;
        echo sprintf("WebP: %-60s %6.1f KB -> %6.1f KB\n", $relUnix, $srcSize / 1024, $newSize / 1024);
    } else {
        @unlink($tmpPath);
        $skippedLarger++;
    }
}

echo "Created/updated {$createdCount} WebP variants ({$skippedLarger} skipped where source was smaller).\n";

// 3. Build crisp 160x160 inline WebP logo for zero-roundtrip splash screen
$logoSource = is_file($mediaDir . DIRECTORY_SEPARATOR . 'yerh-logo.png')
    ? $mediaDir . DIRECTORY_SEPARATOR . 'yerh-logo.png'
    : $mediaDir . DIRECTORY_SEPARATOR . 'yerh-logo-224.webp';

$logoInfo = @getimagesize($logoSource);
if (! $logoInfo) {
    fwrite(STDERR, "Unable to read logo source: {$logoSource}\n");
    exit(1);
}

$logoSrcImg = loadGdImage($logoSource, (int) $logoInfo[2]);
if (! $logoSrcImg instanceof GdImage) {
    fwrite(STDERR, "Unable to decode logo source with GD: {$logoSource}\n");
    exit(1);
}

$inlineSize = 160;
$logoDstImg = imagecreatetruecolor($inlineSize, $inlineSize);
imagealphablending($logoDstImg, false);
imagesavealpha($logoDstImg, true);
$clear = imagecolorallocatealpha($logoDstImg, 0, 0, 0, 127);
imagefilledrectangle($logoDstImg, 0, 0, $inlineSize, $inlineSize, $clear);
imagecopyresampled(
    $logoDstImg,
    $logoSrcImg,
    0,
    0,
    0,
    0,
    $inlineSize,
    $inlineSize,
    $logoInfo[0],
    $logoInfo[1]
);

$tmpInline = tempnam(sys_get_temp_dir(), 'yerh_logo_') . '.webp';
imagewebp($logoDstImg, $tmpInline, 82);
imagedestroy($logoDstImg);
imagedestroy($logoSrcImg);

$inlineBytes = file_get_contents($tmpInline);
@unlink($tmpInline);

if ($inlineBytes === false || $inlineBytes === '') {
    fwrite(STDERR, "Failed to generate inline WebP logo.\n");
    exit(1);
}

$dataUri = 'data:image/webp;base64,' . base64_encode($inlineBytes);
echo sprintf("INLINE_YERH_LOGO bytes=%d dataUriChars=%d\n", strlen($inlineBytes), strlen($dataUri));

$brandInlineTs = "export const INLINE_YERH_LOGO =\n  '{$dataUri}';\n";
file_put_contents($configDir . DIRECTORY_SEPARATOR . 'brand-inline.ts', $brandInlineTs);

// 4. Scan final media directory to emit MEDIA_WEBP_VARIANTS & MEDIA_DIMENSIONS
$finalIterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($mediaDir));
$allMedia = [];
foreach ($finalIterator as $fileInfo) {
    if ($fileInfo->isFile()) {
        $allMedia[] = $fileInfo->getPathname();
    }
}
sort($allMedia);

$webpVariants = [];
$dimensions = [];

foreach ($allMedia as $absPath) {
    $relUnix = str_replace('\\', '/', substr($absPath, strlen($mediaDir) + 1));
    $publicPath = '/media/' . $relUnix;
    $info = @getimagesize($absPath);
    if ($info && $info[0] > 0 && $info[1] > 0) {
        $dimensions[$publicPath] = ['width' => (int) $info[0], 'height' => (int) $info[1]];
    }

    $ext = strtolower(pathinfo($absPath, PATHINFO_EXTENSION));
    if (in_array($ext, ['jpg', 'jpeg', 'png'], true)) {
        $webpAbs = preg_replace('/\.(jpe?g|png)$/i', '.webp', $absPath);
        if (is_file($webpAbs) && filesize($webpAbs) < filesize($absPath)) {
            $webpRel = preg_replace('/\.(jpe?g|png)$/i', '.webp', $relUnix);
            $webpVariants[$publicPath] = '/media/' . $webpRel;
        }
    }
}

ksort($webpVariants);
ksort($dimensions);

$lines = [];
$lines[] = '// Generated by scripts/optimize-media.php';
$lines[] = 'export const MEDIA_WEBP_VARIANTS: Readonly<Record<string, string>> = {';
foreach ($webpVariants as $src => $dst) {
    $lines[] = "  '{$src}': '{$dst}',";
}
$lines[] = '};';
$lines[] = '';
$lines[] = 'export const MEDIA_DIMENSIONS: Readonly<Record<string, { width: number; height: number }>> = {';
foreach ($dimensions as $src => $dim) {
    $lines[] = "  '{$src}': { width: {$dim['width']}, height: {$dim['height']} },";
}
$lines[] = '};';
$lines[] = '';

file_put_contents($configDir . DIRECTORY_SEPARATOR . 'media-variants.ts', implode("\n", $lines));
echo sprintf("Wrote media-variants.ts (%d WebP mappings, %d dimension entries).\n", count($webpVariants), count($dimensions));
