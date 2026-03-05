import { describe, expect, it } from 'vitest';
import { UssdRenderer } from './UssdRenderer.js';

describe('UssdRenderer', () => {
  it('uses caret as newline separator and sanitizes unsupported characters', () => {
    const renderer = new UssdRenderer();
    const output = renderer.renderLines(['Welcome & Start', '1 Vote <Now>']);
    expect(output).toContain('Welcome Start');
    expect(output).toContain('^');
    expect(output).not.toContain('&');
    expect(output).not.toContain('<');
  });

  it('enforces max 160 characters', () => {
    const renderer = new UssdRenderer();
    const output = renderer.renderLines([`A${'b'.repeat(300)}`]);
    expect(output.length).toBeLessThanOrEqual(160);
  });
});

