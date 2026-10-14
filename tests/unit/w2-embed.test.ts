import { describe, expect, it } from 'vitest';
import { embedUrl } from '@/widgets/defs/embed';

describe('embedUrl', () => {
  it('prijme https a doplní schému', () => {
    expect(embedUrl('example.org/a')).toMatchObject({ ok: true, url: 'https://example.org/a' });
    expect(embedUrl('https://www.example.org')).toMatchObject({ ok: true, host: 'example.org' });
  });
  it.each(['http://example.org', 'javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'ftp://example.org', 'https://u:p@example.org', 'https://ex ample.org', ''])('odmietne %j', (u) => {
    expect(embedUrl(u).ok).toBe(false);
  });
});
