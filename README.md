# Ainu Wiktionary Generator

A web-based tool designed to streamline the creation of Wiktionary entries for the Ainu language. This project helps automate the formatting of Wikitext, ensuring consistency and ease of use for contributors.

## Features

- **Wikitext Generation**: Automatically generates formatted Wikitext for Ainu entries.
- **Locale Support**: Supports styling and formatting for both English and Japanese Wiktionary.
- **Interactive UI**: Built with Svelte for a responsive and user-friendly experience.

## Development

This project is built with [SvelteKit](https://svelte.dev/docs/kit).

### Prerequisites

- Node.js (or Bun) installed on your machine.
- `sqlite3` CLI installed if you want to replace the remote D1 database.

### Getting Started

1.  Clone the repository.
2.  Install dependencies:

    ```sh
    bun install
    ```

3.  Start the development server:

    ```sh
     bun run dev
    ```

## Corpus Database Workflow

The examples API reads from the Cloudflare D1 database bound as `DB`. The source corpus is expected as a generated JSONL artifact published from the private upstream repository.

### Download latest private artifact

Download the latest release artifact into the gitignored `.private/` directory:

```sh
bun run db:download-corpora
```

By default this uses:

- repo: `aynumosir/ainu-corpora`
- release: `latest`
- asset pattern: `*.jsonl*`
- download dir: `.private/artifacts`

The download script uses GitHub CLI and works with either:

- `gh auth login`
- `GH_TOKEN` set in your shell or CI

Useful overrides:

```sh
GH_TOKEN=... \
AINU_CORPORA_RELEASE_REPO=aynumosir/ainu-corpora \
AINU_CORPORA_RELEASE_TAG=latest \
AINU_CORPORA_RELEASE_PATTERN='*.jsonl.gz' \
bun run db:download-corpora
```

### Build a local SQLite database

Generate a fresh local database from the downloaded JSONL artifact:

```sh
bun run db:build-corpora
```

Default paths:

- Artifact input: newest `.jsonl` or `.jsonl.gz` in `.private/artifacts`
- Generated database: `data/ainu_corpora.db`

You can override them:

```sh
bun run db:build-corpora --input /absolute/path/to/data.jsonl.gz --out /absolute/path/to/ainu_corpora.db
```

### Replace the remote D1 database

This is a destructive operation for the current corpus tables in D1. The replacement script downloads the latest artifact unless told not to, rebuilds the SQLite database, exports it with `sqlite3 .dump`, drops the existing `tokens`, `sentences`, and `documents` tables in D1, and imports the new dump.

```sh
GH_TOKEN=... \
CONFIRM_D1_REPLACE=1 \
D1_DATABASE_NAME=ainu-corpora-db-20251204-v3 \
bun run db:replace-corpora
```

Requirements before running it:

- GitHub CLI is authenticated, or `GH_TOKEN` is set if the artifact source is private.
- `sqlite3` is installed locally.
- `wrangler` is authenticated against the Cloudflare account that owns the D1 database.
- `D1_DATABASE_NAME` matches the target database name in `wrangler.jsonc`.

Optional overrides:

- `AINU_CORPORA_ARTIFACT_PATH` to use a specific `.jsonl` or `.jsonl.gz` file.
- `AINU_CORPORA_ARTIFACT_DIR` to change the artifact download/search directory.
- `AINU_CORPORA_RELEASE_REPO` to change the GitHub source repo.
- `AINU_CORPORA_RELEASE_TAG` to download a specific release tag instead of `latest`.
- `AINU_CORPORA_RELEASE_PATTERN` to target a specific asset name.
- `AINU_CORPORA_DB_PATH` to change the generated SQLite path.
- `AINU_CORPORA_SQL_PATH` to change the generated SQL dump path.
- `SKIP_CORPORA_DOWNLOAD=1` to skip the release download step when the artifact is already present locally.
- `SKIP_DB_BUILD=1` to reuse an existing local SQLite DB on retry.
- `SKIP_SQL_BUILD=1` to reuse an existing generated SQL file on retry.

### Manual workflow summary

1. Authenticate GitHub CLI or export `GH_TOKEN`.
2. Run `bun run db:download-corpora`.
3. Run `bun run db:build-corpora`.
4. Inspect `data/ainu_corpora.db` locally if needed.
5. Run `CONFIRM_D1_REPLACE=1 D1_DATABASE_NAME=... bun run db:replace-corpora`.
6. Verify the examples API against the updated D1 data.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Copyright (c) 2025 mkpoli
