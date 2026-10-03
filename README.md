# chinmaymurugkar.com

Personal site for Chinmay Murugkar. Plain static HTML/CSS — no build step, no framework.

## Structure
- `index.html` — the whole site (single page).
- `styles.css` — styling (dark theme).
- `favicon.svg` — site icon.

Edit the content directly in `index.html`. Add posts/projects as `<li>` items in the **Writing & projects** section.

## Run locally
Just open `index.html` in a browser, or serve it:

```bash
python3 -m http.server 8000
# visit http://localhost:8000
```

## Deploy to Vercel
1. Create a GitHub repo and push this folder.
2. In Vercel, **Add New → Project → Import** the repo.
3. Framework preset: **Other**. Build command: none. Output directory: `./` (root). Deploy.
4. Every `git push` to the main branch auto-deploys.

## Point chinmaymurugkar.com at this site
The domain is currently registered through WordPress.com. You don't need to transfer
it to go live:

1. Vercel → Project → **Settings → Domains** → add `chinmaymurugkar.com` and `www.chinmaymurugkar.com`.
2. WordPress.com → **Domains → chinmaymurugkar.com → DNS records**, then set:
   - **A** record `@` → `76.76.21.21`
   - **CNAME** `www` → `cname.vercel-dns.com`
   - Remove the old WordPress A/CNAME records.
3. Wait for DNS to propagate; Vercel auto-issues SSL.

### Fully leaving WordPress (optional, after the site is live)
- Transfer the domain out to a neutral registrar (Cloudflare Registrar ~$10/yr, or Namecheap):
  unlock the domain in WordPress.com, copy the auth/EPP code, start the transfer at the new registrar.
- Only after the transfer completes, cancel the WordPress.com Personal plan.
