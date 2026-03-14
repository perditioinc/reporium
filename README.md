# Reporium

Reporium is your GitHub knowledge library — visualize and explore all your public repos.

![Screenshot](public/screenshot-placeholder.png)

## Fork & Run Your Own Instance

1. Fork this repo
2. Go to: your fork → Settings → Secrets and variables → Actions
3. Add secret: `GITHUB_USERNAME` = your-github-username
4. Go to: Settings → Pages → Source: GitHub Actions
5. Push any commit to main (or manually trigger the deploy workflow)
6. Your library is live at: `yourusername.github.io/reporium`

## Local Development

```bash
npm install
cp .env.example .env.local
# Edit .env.local: set GITHUB_USERNAME and optionally GITHUB_TOKEN
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API

```
GET /api/repos/{username}
```

Returns enriched `LibraryData` JSON with all public repos, tags, stats, and metadata for any GitHub username. No authentication required.

Example: `https://reporium.com/api/repos/perditioinc`

Response shape: See [src/types/repo.ts](src/types/repo.ts)

## Custom Domain (Vercel)

Deploy to Vercel for automatic Next.js support and connect your custom domain in the Vercel dashboard.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
