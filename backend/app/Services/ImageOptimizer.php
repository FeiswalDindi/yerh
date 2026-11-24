<?php

namespace App\Services;

use DateTimeImmutable;
use GdImage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

final class ImageOptimizer
{
    public const WIDTH_BUCKETS = [320, 480, 640, 800, 1200, 1600];

    public const MAX_PIXELS = 25_000_000;

    public function snapWidth(?int $requested): ?int
    {
        if ($requested === null || $requested <= 0) {
            return null;
        }

        foreach (self::WIDTH_BUCKETS as $bucket) {
            if ($requested <= $bucket) {
                return $bucket;
            }
        }

        return 1600;
    }

    /** @return array{width: int, height: int}|null */
    public function inspectDimensions(string $absolutePath): ?array
    {
        $info = @getimagesize($absolutePath);
        if (! is_array($info) || ($info[0] ?? 0) <= 0 || ($info[1] ?? 0) <= 0) {
            return null;
        }

        return [
            'width' => (int) $info[0],
            'height' => (int) $info[1],
        ];
    }

    /** @return array{path: string, mime: string, is_variant: bool} */
    public function prepareVariant(
        string $disk,
        string $sourcePath,
        string $cacheKey,
        ?int $requestedWidth,
        bool $preferWebp,
    ): array {
        $storage = Storage::disk($disk);
        $sourceAbs = $storage->path($sourcePath);
        $info = @getimagesize($sourceAbs);
        $origMime = is_array($info) && ! empty($info['mime'])
            ? (string) $info['mime']
            : ((string) (@mime_content_type($sourceAbs) ?: 'application/octet-stream'));

        if (! extension_loaded('gd') || ! is_array($info)) {
            return ['path' => $sourcePath, 'mime' => $origMime, 'is_variant' => false];
        }

        $imageType = (int) ($info[2] ?? 0);
        if (! in_array($origMime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
            return ['path' => $sourcePath, 'mime' => $origMime, 'is_variant' => false];
        }

        $origWidth = (int) ($info[0] ?? 0);
        $origHeight = (int) ($info[1] ?? 0);
        if ($origWidth <= 0 || $origHeight <= 0 || ($origWidth * $origHeight) > self::MAX_PIXELS) {
            return ['path' => $sourcePath, 'mime' => $origMime, 'is_variant' => false];
        }

        $exifOrientation = 1;
        if ($imageType === IMAGETYPE_JPEG && function_exists('exif_read_data')) {
            $exif = @exif_read_data($sourceAbs);
            $exifOrientation = (int) ($exif['Orientation'] ?? 1);
            if (in_array($exifOrientation, [5, 6, 7, 8], true)) {
                [$origWidth, $origHeight] = [$origHeight, $origWidth];
            }
        }

        $snapped = $this->snapWidth($requestedWidth);
        $effectiveWidth = ($snapped !== null && $snapped < $origWidth) ? $snapped : null;
        $useWebp = $preferWebp && function_exists('imagewebp');

        if ($effectiveWidth === null && (! $useWebp || $origMime === 'image/webp')) {
            return ['path' => $sourcePath, 'mime' => $origMime, 'is_variant' => false];
        }

        $extFromMime = match ($origMime) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            default => 'img',
        };
        $targetExt = $useWebp ? 'webp' : $extFromMime;
        $targetMime = $useWebp ? 'image/webp' : $origMime;
        $cachePath = 'image-cache/'.$cacheKey.'/w'.($effectiveWidth ?? 'orig').'.'.$targetExt;
        $cachedAbs = $storage->path($cachePath);

        if ($storage->exists($cachePath) && (@filemtime($cachedAbs) >= @filemtime($sourceAbs))) {
            return ['path' => $cachePath, 'mime' => $targetMime, 'is_variant' => true];
        }

        $srcImg = $this->decodeGdImage($sourceAbs, $imageType, $exifOrientation);
        if (! $srcImg instanceof GdImage) {
            return ['path' => $sourcePath, 'mime' => $origMime, 'is_variant' => false];
        }

        $srcWidth = imagesx($srcImg);
        $srcHeight = imagesy($srcImg);
        $outputImg = $srcImg;

        if ($effectiveWidth !== null && $effectiveWidth < $srcWidth) {
            $targetWidth = $effectiveWidth;
            $targetHeight = max(1, (int) round(($srcHeight / $srcWidth) * $targetWidth));
            $resized = imagecreatetruecolor($targetWidth, $targetHeight);
            if (! $resized instanceof GdImage) {
                $this->releaseGd($srcImg);

                return ['path' => $sourcePath, 'mime' => $origMime, 'is_variant' => false];
            }

            imagealphablending($resized, false);
            imagesavealpha($resized, true);
            $transparent = imagecolorallocatealpha($resized, 0, 0, 0, 127);
            imagefilledrectangle($resized, 0, 0, $targetWidth, $targetHeight, $transparent);
            imagecopyresampled($resized, $srcImg, 0, 0, 0, 0, $targetWidth, $targetHeight, $srcWidth, $srcHeight);
            $this->releaseGd($srcImg);
            $outputImg = $resized;
        }

        File::ensureDirectoryExists(dirname($cachedAbs));
        $tmpAbs = $cachedAbs.'.tmp.'.bin2hex(random_bytes(4));

        $encoded = match ($targetExt) {
            'webp' => @imagewebp($outputImg, $tmpAbs, 82),
            'jpg' => @imagejpeg($outputImg, $tmpAbs, 82),
            'png' => @imagepng($outputImg, $tmpAbs, 6),
            default => false,
        };
        $this->releaseGd($outputImg);

        if (! $encoded || ! is_file($tmpAbs)) {
            @unlink($tmpAbs);

            return ['path' => $sourcePath, 'mime' => $origMime, 'is_variant' => false];
        }

        clearstatcache(true, $tmpAbs);
        clearstatcache(true, $sourceAbs);
        if ($effectiveWidth === null && @filesize($tmpAbs) >= @filesize($sourceAbs)) {
            @unlink($tmpAbs);

            return ['path' => $sourcePath, 'mime' => $origMime, 'is_variant' => false];
        }

        if (! @rename($tmpAbs, $cachedAbs)) {
            @unlink($tmpAbs);
            if ($storage->exists($cachePath)) {
                return ['path' => $cachePath, 'mime' => $targetMime, 'is_variant' => true];
            }

            return ['path' => $sourcePath, 'mime' => $origMime, 'is_variant' => false];
        }

        return ['path' => $cachePath, 'mime' => $targetMime, 'is_variant' => true];
    }

    public function purgeCache(string $disk, string $cacheKey): void
    {
        Storage::disk($disk)->deleteDirectory('image-cache/'.$cacheKey);
    }

    public function serveFile(
        Request $request,
        string $absolutePath,
        string $mimeType,
        bool $varyAccept = true,
    ): BinaryFileResponse {
        clearstatcache(true, $absolutePath);
        $mtime = @filemtime($absolutePath) ?: time();
        $size = @filesize($absolutePath) ?: 0;

        $headers = [
            'Content-Type' => $mimeType,
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ];
        if ($varyAccept) {
            $headers['Vary'] = 'Accept';
        }

        $response = response()->file($absolutePath, $headers);
        $response->setEtag(sha1($absolutePath.'|'.$mtime.'|'.$size));
        $response->setLastModified((new DateTimeImmutable)->setTimestamp($mtime));
        $response->isNotModified($request);

        return $response;
    }

    private function decodeGdImage(string $absolutePath, int $imageType, int $exifOrientation): ?GdImage
    {
        $image = match ($imageType) {
            IMAGETYPE_JPEG => @imagecreatefromjpeg($absolutePath),
            IMAGETYPE_PNG => @imagecreatefrompng($absolutePath),
            IMAGETYPE_WEBP => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($absolutePath) : false,
            default => false,
        };

        if (! $image instanceof GdImage) {
            return null;
        }

        if ($imageType === IMAGETYPE_JPEG) {
            $angle = match ($exifOrientation) {
                3 => 180,
                6 => -90,
                8 => 90,
                default => 0,
            };
            if ($angle !== 0) {
                $rotated = @imagerotate($image, $angle, 0);
                if ($rotated instanceof GdImage) {
                    $this->releaseGd($image);
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

    private function releaseGd(GdImage $image): void
    {
        if (PHP_VERSION_ID < 80500) {
            @imagedestroy($image);
        }
        unset($image);
    }
};
