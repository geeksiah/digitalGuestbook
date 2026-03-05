const DISALLOWED_CHARS = /[\$`<'&]/g;
const MAX_USSD_CHARS = 160;

const sanitizeLine = (line: string) =>
  line
    .replace(DISALLOWED_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export class UssdRenderer {
  static readonly MAX_CHARS = MAX_USSD_CHARS;

  sanitize(input: string): string {
    return sanitizeLine(String(input || ''));
  }

  renderLines(lines: string[]): string {
    const sanitized = lines
      .map((line) => this.sanitize(line))
      .filter((line) => line.length > 0);
    const joined = sanitized.join('^');
    if (joined.length <= MAX_USSD_CHARS) return joined;
    return joined.slice(0, MAX_USSD_CHARS - 1).trimEnd() + '…';
  }
}

