export function stripUnmatchedAsciiDoubleQuote(value: string): string {
	const quoteCount = [...value].filter((char) => char === '"').length;
	if (quoteCount % 2 === 0) return value;

	if (/^\s*"/u.test(value)) {
		return value.replace(/^(\s*)"/u, '$1');
	}

	if (/"\s*$/u.test(value)) {
		return value.replace(/"(\s*)$/u, '$1');
	}

	return value;
}
