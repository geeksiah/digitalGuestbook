"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UssdRenderer = void 0;
const DISALLOWED_CHARS = /[\$`<'&]/g;
const MAX_USSD_CHARS = 160;
const sanitizeLine = (line) => line
    .replace(DISALLOWED_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
class UssdRenderer {
    static MAX_CHARS = MAX_USSD_CHARS;
    sanitize(input) {
        return sanitizeLine(String(input || ''));
    }
    renderLines(lines) {
        const sanitized = lines
            .map((line) => this.sanitize(line))
            .filter((line) => line.length > 0);
        const joined = sanitized.join('^');
        if (joined.length <= MAX_USSD_CHARS)
            return joined;
        return joined.slice(0, MAX_USSD_CHARS - 1).trimEnd() + '…';
    }
}
exports.UssdRenderer = UssdRenderer;
//# sourceMappingURL=UssdRenderer.js.map