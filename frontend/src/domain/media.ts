/** Only known YouTube hosts and valid video IDs may become iframe destinations. */
export function youtubeEmbedUrl(input: string): string | null {
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:') return null;
    let id: string | null = null;
    if (url.hostname === 'youtu.be') id = url.pathname.slice(1);
    else if (
      ['youtube.com', 'www.youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname)
    ) {
      id =
        url.pathname === '/watch'
          ? url.searchParams.get('v')
          : (url.pathname.match(/^\/(?:embed|shorts|v)\/([^/]+)$/)?.[1] ?? null);
    }
    return id && /^[\w-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch {
    return null;
  }
}
