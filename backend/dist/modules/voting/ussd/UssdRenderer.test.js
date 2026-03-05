"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const UssdRenderer_js_1 = require("./UssdRenderer.js");
(0, vitest_1.describe)('UssdRenderer', () => {
    (0, vitest_1.it)('uses caret as newline separator and sanitizes unsupported characters', () => {
        const renderer = new UssdRenderer_js_1.UssdRenderer();
        const output = renderer.renderLines(['Welcome & Start', '1 Vote <Now>']);
        (0, vitest_1.expect)(output).toContain('Welcome Start');
        (0, vitest_1.expect)(output).toContain('^');
        (0, vitest_1.expect)(output).not.toContain('&');
        (0, vitest_1.expect)(output).not.toContain('<');
    });
    (0, vitest_1.it)('enforces max 160 characters', () => {
        const renderer = new UssdRenderer_js_1.UssdRenderer();
        const output = renderer.renderLines([`A${'b'.repeat(300)}`]);
        (0, vitest_1.expect)(output.length).toBeLessThanOrEqual(160);
    });
});
//# sourceMappingURL=UssdRenderer.test.js.map