export type PartOfSpeech =
  | 'noun' | 'verb' | 'adj' | 'adv' | 'participle' | 'aux';

export interface Definition {
  gloss: string;          // "送る"
  examples?: Example[];   // Auto-citation list
}

export interface Example {
  text: string;           // "sonko omante"
  translation: string;    // "手紙を送る"
  ref?: string;           // Citation key
}

export interface AinuEntry {
  lemma: string;          // "omante"
  pos: PartOfSpeech;      // "verb"
  transitivity?: 'transitive' | 'intransitive';
  etymology?: string[];   // ["oman", "-te"]
  definitions: Definition[];
  pronunciation?: {
    ipa?: boolean;        // If true, add {{ain-IPA}}
  };
}

export function renderWikitext(entry: AinuEntry): string {
  const parts: string[] = [];

  // 1. Header & Script
  parts.push(`=={{ain}}==`);
  parts.push(`{{ain-kana}}`); // Relies on template auto-conversion

  // 2. Pronunciation
  parts.push(`==={{pron|ain}}===`);
  parts.push(`* {{ain-IPA}}`);

  // 3. Etymology (Replaces your 'compile_compound' logic)
  if (entry.etymology && entry.etymology.length > 0) {
    parts.push(`==={{etym}}===`);
    // Simple join for now, can get complex later
    const etymStr = entry.etymology
      .map((comp) => `{{l|ain|${comp}}}`)
      .join(' + ');
    parts.push(etymStr);
  }

  // 4. Part of Speech Header
  parts.push(`==={{${entry.pos}}}===`);

  // 5. Headword & Context
  let headLine = `{{head|ain|${entry.pos}}}`;
  if (entry.transitivity) {
    headLine += ` {{context|${entry.transitivity}|lang=ain}}`;
  }
  parts.push(headLine);

  // 6. Definitions & Examples
  entry.definitions.forEach(def => {
    parts.push(`# ${def.gloss}`);
    if (def.examples) {
      def.examples.forEach(ex => {
        parts.push(`#* {{l|ain|${ex.text}}}「${ex.translation}」`);
      });
    }
  });

  return parts.join('\n');
}