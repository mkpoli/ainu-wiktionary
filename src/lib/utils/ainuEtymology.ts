import type { LinkMeta } from './wikitext';

type AinuEtymologyPreset = Omit<LinkMeta, 'term'> & {
	term?: string;
};

const EQUALS_TEMPLATE = /\{\{=\}\}/g;

const AINU_ETYMOLOGY_PRESETS: Record<string, AinuEtymologyPreset> = {
	'i=': { term: 'i=', tran: 'ものを/人を', pos: '一般目的語接頭辞' }, // APASS
	'i-': { term: 'i=', tran: 'ものを/人を', pos: '一般目的語接頭辞' }, // APASS
	'a=': { term: 'a=', tran: '人が', pos: '不定人称接辞' }, // IND, 4.A
	'a-': { term: 'a=', tran: '人が', pos: '不定人称接辞' }, // IND, 4.A
	'ci=': { term: 'ci=', tran: '人が/自然に', pos: '中動態接頭辞' }, // MID, ANTIC
	'ci-': { term: 'ci=', tran: '人が/自然に', pos: '中動態接頭辞' }, // MID, ANTIC

	'ku=': { term: 'ku=', tran: '私が', pos: '人称接辞' }, // 1SG.A
	'k=': { term: 'k=', tran: '私が', pos: '人称接辞' }, // 1SG.A
	'en=': { term: 'en=', tran: '私を/に', pos: '人称接辞' }, // 1SG.O
	'un=': { term: 'un=', tran: '私達を/に', pos: '人称接辞' }, // 1PL.EXCL.O
	'e=': { term: 'e=', tran: 'お前が/を/に', pos: '人称接辞' }, // 2SG
	'eci=': { term: 'eci=', tran: 'お前達が/を/に', pos: '人称接辞' }, // 2PL
	'=an': { term: '=an', tran: '人が/される', pos: '不定人称接辞' }, // IND
	'=as': { term: '=as', tran: '私達が', pos: '人称接辞' }, // 1PL.EXCL.A

	'e-': { tran: '〜で/〜について/〜へ', pos: '充当接頭辞' }, // APPL
	'ko-': { tran: '〜に/〜とともに', pos: '充当接頭辞' }, // APPL
	'o-': { tran: '〜に/〜から/〜で', pos: '充当接頭辞' }, // APPL
	'u-': { tran: '互いに', pos: '相互接頭辞' }, // RECP
	'yay-': { tran: '自分を/自分で', pos: '再帰接頭辞' }, // REFL
	'si-': { tran: '自分を/自然に', pos: '再帰接頭辞' }, // MID

	'ar-': { tran: '全く/本当に', pos: '強意接頭辞' }, // INTENS
	'ru-': { tran: 'やや/少し', pos: '副詞的接頭辞' }, // DEG
	'he-': { tran: '頭/上部', pos: '名詞的接頭辞' },

	'-re': { tran: 'させる', pos: '使役接尾辞' }, // CAUS
	'-te': { tran: 'させる', pos: '使役接尾辞' }, // CAUS
	'-e': { tran: 'させる', pos: '使役接尾辞' }, // CAUS
	'-yar': { tran: 'させる', pos: '不定使役接尾辞' }, // INDF.CAUS
	'-ar': { tran: 'させる', pos: '不定使役接尾辞' }, // INDF.CAUS
	'-pa': { tran: '複数/反復', pos: '動詞複数接尾辞' }, // PL
	'-n': { tran: '単数自動詞', pos: '動詞法語尾' }, // ITR.SG
	'-p': { tran: 'もの', pos: '名詞化辞' }, // NMLZ
	'-pe': { tran: 'もの', pos: '名詞化辞' }, // NMLZ
	'-ka': { tran: 'させる/他動詞化', pos: '他動詞形成接辞' }, // TR
	'-ke': { tran: 'させる/他動詞化', pos: '動詞形成接尾辞' }, // TR
	'-V': { tran: 'させる/他動詞化', pos: '他動詞語尾' }, // TR
	'-kosanu': { tran: '急に〜する', pos: '動詞形成接辞' }, // MOM
	'-kosanpa': { tran: '急に〜する', pos: '動詞形成接辞' }, // MOM
	'-natara': { tran: '〜し続ける', pos: '動詞形成接辞' }, // CONT
	'-itara': { tran: '〜し続ける', pos: '動詞形成接辞' }, // CONT
	'-se': { tran: '〜と鳴る/言う', pos: '動詞形成接尾辞' },
	'-no': { tran: '〜に/〜く', pos: '副詞形成接辞' }, // ADVZ
	'-po': { tran: '小さな/愛らしい', pos: '指小辞' }, // DIM
	'-hV': { tran: '所属', pos: '所属形語尾' }, // POSS
	'-hi': { tran: '所属', pos: '所属形語尾' }, // POSS
	'-i': { tran: '所属/ところ', pos: '所属形語尾' } // POSS
};

const EXPLICIT_PREFIXES = ['i=', 'a=', 'ci=', 'yay-', 'u-', 'si-', 'e-', 'ko-', 'o-', 'ar-', 'ru-'];
const COMPACT_PREFIXES = [{ surface: 'yay', term: 'yay-' }];
const SURFACE_SUFFIXES = [
	'kosanpa',
	'kosanu',
	'natara',
	'itara',
	'yar',
	're',
	'te',
	'ka',
	'ke',
	'pa',
	'se'
];

export function normalizeAinuEtymologyTerm(term: string): string {
	return term.trim().replace(EQUALS_TEMPLATE, '=').normalize('NFC');
}

export function escapeAinuAffixTerm(term: string): string {
	return normalizeAinuEtymologyTerm(term).replaceAll('=', '{{=}}');
}

export function applyAinuEtymologyPreset(meta: LinkMeta): LinkMeta {
	const normalizedTerm = normalizeAinuEtymologyTerm(meta.term);
	const preset = AINU_ETYMOLOGY_PRESETS[normalizedTerm];
	if (!preset) return { ...meta, term: normalizedTerm || meta.term };

	return {
		...meta,
		term: meta.term.trim() ? (preset.term ?? normalizedTerm) : meta.term,
		alt: meta.alt || preset.alt,
		tran: meta.tran || preset.tran,
		pos: meta.pos || preset.pos
	};
}

export function parseAinuEtymologyInput(input: string): LinkMeta[] {
	if (!input) return [];
	return input
		.split(/[,+]/)
		.map((s) => {
			const trimmed = s.trim();
			const match = trimmed.match(/^([^(]+)(?:\(([^)]+)\))?$/);
			if (match) {
				return applyAinuEtymologyPreset({ term: match[1].trim(), tran: match[2]?.trim() });
			}
			return applyAinuEtymologyPreset({ term: trimmed });
		})
		.filter((l) => l.term);
}

export function mergeAinuEtymologyTerms(left: LinkMeta, right: LinkMeta): LinkMeta {
	const leftTerm = normalizeAinuEtymologyTerm(left.term);
	const rightTerm = normalizeAinuEtymologyTerm(right.term);
	const mergedTerm = `${leftTerm.endsWith('-') ? leftTerm.slice(0, -1) : leftTerm}${
		rightTerm.startsWith('-') ? rightTerm.slice(1) : rightTerm
	}`;
	return applyAinuEtymologyPreset({ term: mergedTerm });
}

export function splitAinuEtymologyTerm(term: LinkMeta, input?: string): LinkMeta[] {
	const parsed = input?.trim()
		? parseAinuEtymologyInput(input)
		: suggestAinuLemmaEtymology(term.term);
	return parsed.length > 0 ? parsed : [term];
}

export function suggestAinuLemmaEtymology(lemma: string): LinkMeta[] {
	let remaining = normalizeAinuEtymologyTerm(lemma).replaceAll(' ', '');
	if (!remaining) return [];
	if (/[,+]/.test(remaining)) return parseAinuEtymologyInput(remaining);

	const components: LinkMeta[] = [];
	let changed = false;

	for (const prefix of EXPLICIT_PREFIXES) {
		if (remaining.startsWith(prefix) && remaining.length > prefix.length) {
			components.push(applyAinuEtymologyPreset({ term: prefix }));
			remaining = remaining.slice(prefix.length);
			changed = true;
			break;
		}
	}

	for (const prefix of COMPACT_PREFIXES) {
		if (remaining.startsWith(prefix.surface) && remaining.length > prefix.surface.length + 1) {
			components.push(applyAinuEtymologyPreset({ term: prefix.term }));
			remaining = remaining.slice(prefix.surface.length);
			changed = true;
			break;
		}
	}

	const suffixes: LinkMeta[] = [];
	for (const suffix of SURFACE_SUFFIXES) {
		if (remaining.endsWith(suffix) && remaining.length > suffix.length + 1) {
			suffixes.unshift(applyAinuEtymologyPreset({ term: `-${suffix}` }));
			remaining = remaining.slice(0, -suffix.length);
			changed = true;
			break;
		}
	}

	if (!changed) return [];
	if (remaining) components.push({ term: remaining });
	components.push(...suffixes);
	return components;
}
