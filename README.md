# Veneranda University — Frontend

Angular LMS UI deployed to **GitHub Pages**.

## Live URL

After enabling Pages: `https://<your-github-username>.github.io/veneranda-university-frontend/`

## GitHub setup (one time)

1. Push this repo to GitHub as `veneranda-university-frontend` (or any name — base href uses the repo name).
2. **Settings → Pages → Build and deployment → Source:** GitHub Actions.
3. **Settings → Secrets → Actions** (optional):
   - `API_URL` — e.g. `https://veneranda-university-backend.onrender.com/api/v1`
   - `GOOGLE_CLIENT_ID` — OAuth web client ID

Every push to `main` rebuilds and deploys automatically.

## Local dev

```bash
npm install
npm start
```

App runs at http://localhost:4900 with API at http://localhost:8081.

## Google Sign-In (production)

In [Google Cloud Console](https://console.cloud.google.com/), add authorized JavaScript origins:

- `https://<username>.github.io`

Authorized redirect URIs are not required for GIS One Tap / button flow.

## Backend + database

See the **veneranda-university-backend** repo for Render + Supabase setup.
