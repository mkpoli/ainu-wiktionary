#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACT_PATH="${AINU_CORPORA_ARTIFACT_PATH:-}"
DB_PATH="${AINU_CORPORA_DB_PATH:-$ROOT_DIR/data/ainu_corpora.db}"
SQL_PATH="${AINU_CORPORA_SQL_PATH:-$ROOT_DIR/data/ainu_corpora.import.sql}"
DATABASE_NAME="${D1_DATABASE_NAME:-}"
CONFIRM_REPLACE="${CONFIRM_D1_REPLACE:-0}"
SKIP_CORPORA_DOWNLOAD="${SKIP_CORPORA_DOWNLOAD:-0}"
SKIP_DB_BUILD="${SKIP_DB_BUILD:-0}"
SKIP_SQL_BUILD="${SKIP_SQL_BUILD:-0}"

build_d1_import_sql() {
	: > "$SQL_PATH"
	for table in documents sentences tokens; do
		sqlite3 "$DB_PATH" <<EOF >> "$SQL_PATH"
SELECT sql || ';'
FROM sqlite_master
WHERE sql IS NOT NULL
	AND name NOT LIKE 'sqlite_%'
	AND (name = '$table' OR tbl_name = '$table')
ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name;
EOF
		printf '\n' >> "$SQL_PATH"
	done
	printf '\n' >> "$SQL_PATH"

	for table in documents sentences tokens; do
		sqlite3 "$DB_PATH" <<EOF >> "$SQL_PATH"
.mode insert $table
SELECT * FROM $table;
EOF
		printf '\n' >> "$SQL_PATH"
	done
}

if [[ -z "$DATABASE_NAME" ]]; then
	printf 'Set D1_DATABASE_NAME before running this script.\n' >&2
	exit 1
fi

if [[ "$CONFIRM_REPLACE" != "1" ]]; then
	printf 'Set CONFIRM_D1_REPLACE=1 to confirm dropping and replacing the remote D1 tables.\n' >&2
	exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
	printf 'sqlite3 CLI is required to create the import dump.\n' >&2
	exit 1
fi

if [[ "$SKIP_CORPORA_DOWNLOAD" != "1" ]]; then
	bash "$ROOT_DIR/scripts/download-corpora-artifact.sh"
fi

if [[ "$SKIP_DB_BUILD" != "1" ]]; then
	if [[ -n "$ARTIFACT_PATH" ]]; then
		bun run "$ROOT_DIR/scripts/build-corpora.ts" --input "$ARTIFACT_PATH" --out "$DB_PATH"
	else
		bun run "$ROOT_DIR/scripts/build-corpora.ts" --out "$DB_PATH"
	fi
fi

if [[ "$SKIP_SQL_BUILD" != "1" ]]; then
	build_d1_import_sql
fi

bunx wrangler d1 execute "$DATABASE_NAME" --remote --yes --command "PRAGMA foreign_keys=OFF; DROP TABLE IF EXISTS tokens; DROP TABLE IF EXISTS sentences; DROP TABLE IF EXISTS documents;"
bunx wrangler d1 execute "$DATABASE_NAME" --remote --yes --file "$SQL_PATH"

printf 'Replaced D1 database %s using %s\n' "$DATABASE_NAME" "$SQL_PATH"
