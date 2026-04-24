<?php
/**
 * Radius SEO Proxy — Drop-in Edge Cache
 *
 * Place this file in your web root and configure the constants below.
 * See README.md for the full 3-step setup guide.
 *
 * How it works:
 *   1. Apache routes matching requests to this script via .htaccess.
 *   2. The script checks for a locally cached HTML file (24-hour TTL).
 *   3. On a cache miss it fetches from the Radius API, caches the
 *      response, and serves it to the visitor.
 */

// ─── Configuration ───────────────────────────────────────────────────────────
define('RADIUS_API_KEY', 'YOUR_API_KEY_HERE');                    // Your Radius API key
define('RADIUS_API_URL', 'https://your-radius-instance.com');     // Base URL (no trailing slash)
define('RADIUS_CACHE_DIR', __DIR__ . '/radius_cache');            // Local cache directory
define('RADIUS_CACHE_TTL', 86400);                                 // Cache lifetime in seconds (24 h)
// ─────────────────────────────────────────────────────────────────────────────

// Ensure the cache directory exists
if (!is_dir(RADIUS_CACHE_DIR)) {
    mkdir(RADIUS_CACHE_DIR, 0755, true);
}

// Derive the request path
$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$requestPath = parse_url($requestUri, PHP_URL_PATH);
$requestPath = '/' . ltrim($requestPath, '/');

// ─── Handle Location Hub Directory ──────────────────────────────────────────
if ($requestPath === '/locations/' || $requestPath === '/locations') {
    $hubCacheFile = RADIUS_CACHE_DIR . '/hub-index.html';
    if (file_exists($hubCacheFile) && (time() - filemtime($hubCacheFile)) < RADIUS_CACHE_TTL) {
        header('Content-Type: text/html; charset=utf-8');
        header('X-Radius-Cache: HIT');
        readfile($hubCacheFile);
        exit;
    }

    $apiUrl = RADIUS_API_URL . '/v1/hub';
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $apiUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . RADIUS_API_KEY,
            'Accept: text/html',
        ],
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $response !== false) {
        file_put_contents($hubCacheFile, $response, LOCK_EX);
        header('Content-Type: text/html; charset=utf-8');
        header('X-Radius-Cache: MISS');
        echo $response;
        exit;
    }
}

// Build a safe filename for the cache
$cacheKey  = md5($requestPath);
$cacheFile = RADIUS_CACHE_DIR . '/' . $cacheKey . '.html';

// ─── Serve from cache if valid ───────────────────────────────────────────────
if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < RADIUS_CACHE_TTL) {
    header('Content-Type: text/html; charset=utf-8');
    header('X-Radius-Cache: HIT');
    readfile($cacheFile);
    exit;
}

// ─── Fetch from Radius API ──────────────────────────────────────────────────
$apiUrl = RADIUS_API_URL . '/v1/serve?path=' . urlencode($requestPath);

$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL            => $apiUrl,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 15,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_HTTPHEADER     => [
        'Authorization: Bearer ' . RADIUS_API_KEY,
        'Accept: text/html',
    ],
]);

$response   = curl_exec($ch);
$httpCode   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError  = curl_error($ch);
curl_close($ch);

// ─── Handle errors ──────────────────────────────────────────────────────────
if ($response === false || $curlError) {
    http_response_code(502);
    echo '<!DOCTYPE html><html><head><title>Bad Gateway</title></head>';
    echo '<body><h1>502 — Bad Gateway</h1>';
    echo '<p>Unable to reach the Radius content server. Please try again later.</p>';
    echo '</body></html>';
    exit;
}

if ($httpCode === 404) {
    http_response_code(404);
    echo '<!DOCTYPE html><html><head><title>Page Not Found</title></head>';
    echo '<body><h1>404 — Page Not Found</h1>';
    echo '<p>The page you are looking for does not exist.</p>';
    echo '</body></html>';
    exit;
}

if ($httpCode >= 500) {
    http_response_code(502);
    echo '<!DOCTYPE html><html><head><title>Server Error</title></head>';
    echo '<body><h1>502 — Upstream Error</h1>';
    echo '<p>The Radius content server returned an error. Please try again later.</p>';
    echo '</body></html>';
    exit;
}

if ($httpCode !== 200) {
    http_response_code($httpCode);
    echo $response;
    exit;
}

// ─── Cache & serve ──────────────────────────────────────────────────────────
file_put_contents($cacheFile, $response, LOCK_EX);

header('Content-Type: text/html; charset=utf-8');
header('X-Radius-Cache: MISS');
echo $response;
