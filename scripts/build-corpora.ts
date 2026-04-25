import { Database } from 'bun:sqlite';
import { createReadStream, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';

type JsonlRecord = {
	id?: unknown;
	collection_lv1?: unknown;
	collection_lv2?: unknown;
	collection_lv3?: unknown;
	document?: unknown;
	uri?: unknown;
	author?: unknown;
	dialect?: unknown;
	dialect_lv1?: unknown;
	dialect_lv2?: unknown;
	dialect_lv3?: unknown;
	text?: unknown;
	translation?: unknown;
	recorded_at?: unknown;
	published_at?: unknown;
};

const DEFAULT_ARTIFACT_DIR = '.private/artifacts';
const DEFAULT_DB_PATH = 'data/ainu_corpora.db';

const PREFIXES = ['ku', 'k', 'en', 'in', 'ci', 'c', 'un', 'a', 'i', 'an', 'e', 'eci', 'ec'];
const SUFFIXES = ['an', 'as'];

function parseArgs(argv: string[]) {
	const args = new Map<string, string>();

	for (let index = 0; index < argv.length; index += 1) {
		const current = argv[index];
		if (!current.startsWith('--')) {
			continue;
		}

		const next = argv[index + 1];
		if (!next || next.startsWith('--')) {
			throw new Error(`Missing value for argument ${current}`);
		}

		args.set(current, next);
		index += 1;
	}

	return {
		artifactPath: args.get('--input') ? resolve(args.get('--input') as string) : undefined,
		artifactDir: resolve(process.env.AINU_CORPORA_ARTIFACT_DIR ?? DEFAULT_ARTIFACT_DIR),
		outputPath: resolve(args.get('--out') ?? process.env.AINU_CORPORA_DB_PATH ?? DEFAULT_DB_PATH)
	};
}

function normalizeString(value: unknown, fallback = '') {
	if (value === null || value === undefined) {
		return fallback;
	}

	return String(value);
}

function normalizeArray(values: unknown) {
	if (!Array.isArray(values)) {
		return [];
	}

	return values.map((value) => normalizeString(value)).filter(Boolean);
}

function normalizeDialect(record: JsonlRecord) {
	const direct = normalizeString(record.dialect);
	if (direct) {
		return direct;
	}

	const candidates = [
		...normalizeArray(record.dialect_lv3),
		...normalizeArray(record.dialect_lv2),
		...normalizeArray(record.dialect_lv1)
	];

	return candidates.at(-1) ?? '';
}

function getBook(record: JsonlRecord) {
	return (
		normalizeString(record.collection_lv3) ||
		normalizeString(record.collection_lv2) ||
		normalizeString(record.collection_lv1) ||
		normalizeString(record.document, 'Unknown Source')
	);
}

function getDocumentKey(record: JsonlRecord) {
	const id = normalizeString(record.id);
	if (id.includes('#')) {
		return id.split('#', 1)[0];
	}

	return [
		normalizeString(record.collection_lv1),
		normalizeString(record.collection_lv2),
		normalizeString(record.collection_lv3),
		normalizeString(record.document),
		normalizeString(record.author),
		normalizeString(record.uri)
	].join('\u0000');
}

function tokenize(text: string) {
	const cleaned = text.replace(/[,.?!"'“”‘’]/g, '');
	return new Set(cleaned.split(/\s+/).filter(Boolean));
}

function extractAnalysis(token: string) {
	if (token.includes('_')) {
		return {
			lemma: token.replaceAll('_', ''),
			prefixes: null,
			suffixes: null
		};
	}

	if (!token.includes('=') && !token.includes('-')) {
		return {
			lemma: token,
			prefixes: null,
			suffixes: null
		};
	}

	const prefixes: string[] = [];
	let remaining = token;

	while (true) {
		const matched = PREFIXES.find((prefix) => remaining.startsWith(`${prefix}=`));
		if (!matched) {
			break;
		}

		prefixes.push(matched);
		remaining = remaining.slice(matched.length + 1);
	}

	const suffixes: string[] = [];
	while (true) {
		const matched = SUFFIXES.find((suffix) => remaining.endsWith(`=${suffix}`));
		if (!matched) {
			break;
		}

		suffixes.push(matched);
		remaining = remaining.slice(0, -(matched.length + 1));
	}

	return {
		lemma: remaining,
		prefixes: prefixes.length > 0 ? prefixes.join(',') : null,
		suffixes: suffixes.length > 0 ? suffixes.reverse().join(',') : null
	};
}

function initDb(db: Database) {
	db.exec(`
		PRAGMA foreign_keys = ON;

		CREATE TABLE documents (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT,
			book TEXT,
			author TEXT,
			year TEXT,
			published_at TEXT,
			recorded_at TEXT,
			url TEXT,
			dialect TEXT
		);

		CREATE TABLE sentences (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			document_id INTEGER NOT NULL,
			ain TEXT,
			jpn TEXT,
			dialect TEXT,
			FOREIGN KEY(document_id) REFERENCES documents(id)
		);

		CREATE TABLE tokens (
			token TEXT,
			lemma TEXT,
			prefixes TEXT,
			suffixes TEXT,
			sentence_id INTEGER NOT NULL,
			PRIMARY KEY (token, sentence_id),
			FOREIGN KEY(sentence_id) REFERENCES sentences(id)
		);

		CREATE INDEX idx_tokens_token ON tokens(token);
		CREATE INDEX idx_tokens_lemma ON tokens(lemma);
		CREATE INDEX idx_sentences_document_id ON sentences(document_id);
	`);
}

function findLatestArtifact(artifactDir: string) {
	if (!existsSync(artifactDir)) {
		throw new Error(
			`Artifact directory not found: ${artifactDir}\nDownload a JSONL release asset first or pass --input.`
		);
	}

	const candidates = readdirSync(artifactDir)
		.filter((entry) => entry.endsWith('.jsonl') || entry.endsWith('.jsonl.gz'))
		.map((entry) => ({
			path: resolve(artifactDir, entry),
			mtimeMs: statSync(resolve(artifactDir, entry)).mtimeMs
		}))
		.sort((left, right) => right.mtimeMs - left.mtimeMs);

	if (candidates.length === 0) {
		throw new Error(
			`No JSONL artifacts found in ${artifactDir}\nDownload a release asset first or pass --input.`
		);
	}

	return candidates[0].path;
}

function openLineReader(artifactPath: string) {
	const source = createReadStream(artifactPath);
	const input = extname(artifactPath) === '.gz' ? source.pipe(createGunzip()) : source;

	return createInterface({
		input,
		crlfDelay: Infinity
	});
}

async function main() {
	const { artifactPath: inputArgument, artifactDir, outputPath } = parseArgs(process.argv.slice(2));
	const artifactPath =
		inputArgument ??
		resolve(process.env.AINU_CORPORA_ARTIFACT_PATH ?? findLatestArtifact(artifactDir));

	if (!existsSync(artifactPath)) {
		throw new Error(`Artifact file not found: ${artifactPath}`);
	}

	mkdirSync(dirname(outputPath), { recursive: true });
	if (existsSync(outputPath)) {
		rmSync(outputPath);
	}

	const db = new Database(outputPath);
	initDb(db);

	const insertDocument = db.query(
		'INSERT INTO documents (title, book, author, year, published_at, recorded_at, url, dialect) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
	);
	const insertSentence = db.query(
		'INSERT INTO sentences (document_id, ain, jpn, dialect) VALUES (?, ?, ?, ?)'
	);
	const insertToken = db.query(
		'INSERT OR IGNORE INTO tokens (token, lemma, prefixes, suffixes, sentence_id) VALUES (?, ?, ?, ?, ?)'
	);

	const documentIds = new Map<string, number>();
	let lineCount = 0;
	let documentsInserted = 0;
	let sentencesInserted = 0;
	let tokensInserted = 0;
	let skippedLines = 0;
	let failedLines = 0;

	console.log(`Building ${outputPath} from ${artifactPath}`);

	db.exec('BEGIN');

	try {
		const reader = openLineReader(artifactPath);

		for await (const line of reader) {
			lineCount += 1;

			if (!line.trim()) {
				skippedLines += 1;
				continue;
			}

			try {
				const record = JSON.parse(line) as JsonlRecord;
				const ain = normalizeString(record.text);
				const jpn = normalizeString(record.translation);

				if (!ain && !jpn) {
					skippedLines += 1;
					continue;
				}

				const documentKey = getDocumentKey(record);
				let documentId = documentIds.get(documentKey);

				if (!documentId) {
					const documentResult = insertDocument.run(
						normalizeString(record.document, 'Untitled'),
						getBook(record),
						normalizeString(record.author, 'Unknown Author'),
						'',
						normalizeString(record.published_at),
						normalizeString(record.recorded_at),
						normalizeString(record.uri),
						normalizeDialect(record)
					);

					documentId = Number(documentResult.lastInsertRowid);
					documentIds.set(documentKey, documentId);
					documentsInserted += 1;
				}

				const sentenceDialect = normalizeDialect(record);
				const sentenceResult = insertSentence.run(documentId, ain, jpn, sentenceDialect);
				const sentenceId = Number(sentenceResult.lastInsertRowid);
				sentencesInserted += 1;

				for (const token of tokenize(ain)) {
					const analysis = extractAnalysis(token);
					insertToken.run(token, analysis.lemma, analysis.prefixes, analysis.suffixes, sentenceId);
					tokensInserted += 1;
				}
			} catch (error) {
				failedLines += 1;
				console.error(`Failed to import line ${lineCount}`);
				console.error(error);
			}
		}

		db.exec('COMMIT');
	} catch (error) {
		db.exec('ROLLBACK');
		throw error;
	} finally {
		db.close();
	}

	console.log(`Created ${outputPath}`);
	console.log(`Lines read: ${lineCount}`);
	console.log(`Documents: ${documentsInserted}`);
	console.log(`Sentences: ${sentencesInserted}`);
	console.log(`Token rows attempted: ${tokensInserted}`);
	console.log(`Skipped lines: ${skippedLines}`);
	console.log(`Failed lines: ${failedLines}`);
}

await main();
