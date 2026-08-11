# StudyFlow 2

StudyFlow 2 is the modular React + TypeScript successor to the original single-file StudyFlow app. During the preview period it is deployed at `/studyflow/next/`, while the stable application remains at `/studyflow/`.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm validate:data
pnpm test
pnpm build
```

The Vite build is written to `../next`. The repository publishes that folder beside the stable root application.

Pull requests and pushes that touch the React app run data validation, unit tests, a production build, and a check that the committed `next/` artifact matches the source.

## Architecture

- `src/state/` hydrates the catalog and owns persisted application state.
- `src/lib/` contains content validation, scheduling, progress, storage, statistics, and encrypted Gist sync.
- `src/features/` contains the home, study session, mock exam, notes, plan, weak-area, search, and settings screens.
- `src/components/MathText.tsx` is the only boundary that converts trusted study markup to HTML; input is escaped first.
- `public/` contains the two validated public question bundles and static PWA metadata.

The app intentionally uses an in-memory screen state instead of URL routing in the parity release. This keeps GitHub Pages reloads reliable without a server fallback.

## Compatibility contract

The preview deliberately preserves the original browser storage keys and payload shapes:

- `studyflow-v1`
- `studyflow-set-v1`
- `studyflow-plan-v1`
- `studyflow-pass-v1`
- `studyflow-daily-v1`
- `studyflow-sync-v1`
- `studyflow-content-v1`
- `studyflow-builtin-finals-2026-t3-v1`
- `studyflow-pdc-422-drills-v2`

Because stable and preview are served from the same origin, existing progress is available to both versions. The legacy encrypted Gist filename, PBKDF2/AES-GCM parameters, and merge format are also retained.

## Release strategy

1. Keep `/studyflow/` as the stable rollback target.
2. Publish and exercise `/studyflow/next/` on desktop and mobile.
3. After parity is accepted, change the Vite `base` to `/studyflow/` and promote the built output to the repository root.
4. Reintroduce offline/PWA caching only after the online parity release; stale question-bank caches were a known failure mode in the legacy app.

Do not commit tokens, exported progress, QA browser profiles, or local content files.
