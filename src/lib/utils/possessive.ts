import possessiveTsv from '$lib/tables/possessive.tsv?raw';

export type PossessiveRow = {
	lemma: string;
	shortForm: string;
	longForm: string;
	gloss: string;
};

function parsePossessiveRows(tsv: string): PossessiveRow[] {
	return tsv
		.trim()
		.split('\n')
		.slice(1)
		.map((line) => {
			const [lemma = '', shortForm = '', longForm = '', gloss = ''] = line
				.split('\t')
				.map((value) => value.trim());
			return { lemma, shortForm, longForm, gloss };
		})
		.filter((row) => row.lemma && (row.shortForm || row.longForm));
}

export const possessiveRows = parsePossessiveRows(possessiveTsv);

export function getPossessiveRowsByLemma(lemma: string): PossessiveRow[] {
	const normalizedLemma = lemma.trim();
	if (!normalizedLemma) return [];
	return possessiveRows.filter((row) => row.lemma === normalizedLemma);
}

export function getPossessiveRowsByAnyForm(term: string): PossessiveRow[] {
	const normalizedTerm = term.trim();
	if (!normalizedTerm) return [];
	return possessiveRows.filter(
		(row) =>
			row.lemma === normalizedTerm ||
			row.shortForm === normalizedTerm ||
			row.longForm === normalizedTerm
	);
}

export function getPossessiveForms(rows: PossessiveRow[]): string[] {
	const forms = new Set<string>();
	for (const row of rows) {
		if (row.shortForm) forms.add(row.shortForm);
		if (row.longForm) forms.add(row.longForm);
	}
	return [...forms];
}
