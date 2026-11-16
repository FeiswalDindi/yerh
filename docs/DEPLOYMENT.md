# GitHub Pages deployment

The public frontend is deployed from `main` by `.github/workflows/pages.yml` to https://yerh.feiso.me. GitHub Pages must use **GitHub Actions** as its publishing source.

The workflow uses Node 22, installs the lockfile with `npm ci`, runs tests/TypeScript/build, and uploads only `dist`. Archives, private environment files, dependencies and runtime files are not published. Demo sessions remain development-only. This is static hosting, not a database or authentication server.

Namecheap DNS for feiso.me: CNAME host `yerh`, target `feiswaldindi.github.io`, automatic TTL. The repository's Pages custom domain must also be `yerh.feiso.me`. Enable Enforce HTTPS after GitHub provisions the certificate. Other DNS records are independent and must be preserved.

Vite's default `/` base matches this custom domain. The build copies index.html to 404.html so direct visits and refreshes on React routes render the application. GitHub returns HTTP 404 for these fallback requests; for full SEO/status correctness, migrate to hosting with SPA rewrites or prerender routes when needed. The site's in-app not-found route handles unknown paths.

To release: review and commit intended changes, push `main`, then verify the Actions deployment and live homepage/deep links. A failed build does not replace the previous successful deployment. Revert the relevant source commit and push for rollback.

References: https://vite.dev/guide/static-deploy#github-pages and https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
