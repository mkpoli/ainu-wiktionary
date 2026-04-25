#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACT_DIR="${AINU_CORPORA_ARTIFACT_DIR:-$ROOT_DIR/.private/artifacts}"
RELEASE_REPO="${AINU_CORPORA_RELEASE_REPO:-aynumosir/ainu-corpora}"
RELEASE_TAG="${AINU_CORPORA_RELEASE_TAG:-latest}"
RELEASE_PATTERN="${AINU_CORPORA_RELEASE_PATTERN:-*.jsonl*}"

if ! command -v gh >/dev/null 2>&1; then
	printf 'GitHub CLI (gh) is required to download private release artifacts.\n' >&2
	exit 1
fi

if [[ -z "${GH_TOKEN:-}" ]]; then
	if ! gh auth token >/dev/null 2>&1; then
		printf 'Authenticate with `gh auth login` or set GH_TOKEN before downloading private artifacts.\n' >&2
		exit 1
	fi
fi

if [[ "$RELEASE_TAG" == "latest" ]]; then
	if ! RELEASE_TAG="$(gh release view --repo "$RELEASE_REPO" --json tagName --jq '.tagName' 2>/dev/null)"; then
		printf 'Could not resolve the latest release for %s. Check that the repo has releases and that your token can read them.\n' "$RELEASE_REPO" >&2
		exit 1
	fi
fi

mkdir -p "$ARTIFACT_DIR"
gh release download "$RELEASE_TAG" --repo "$RELEASE_REPO" --pattern "$RELEASE_PATTERN" --dir "$ARTIFACT_DIR" --clobber

printf 'Downloaded latest corpus artifact(s) from %s into %s\n' "$RELEASE_REPO" "$ARTIFACT_DIR"
