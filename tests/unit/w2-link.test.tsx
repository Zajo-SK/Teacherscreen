import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { normalizeUrl } from '@/lib/link';
import { WidgetHarness } from './harness';

describe('normalizeUrl', () => {
  it('doplní https a normalizuje', () => {
    expect(normalizeUrl('example.org')).toMatchObject({ ok: true, url: 'https://example.org/', host: 'example.org' });
    expect(normalizeUrl('  http://www.Example.org/a?b=1 ')).toMatchObject({ ok: true, url: 'http://www.example.org/a?b=1', host: 'example.org' });
    expect(normalizeUrl('example.org:8080/x')).toMatchObject({ ok: true, url: 'https://example.org:8080/x' });
    expect(normalizeUrl('//example.org')).toMatchObject({ ok: true, url: 'https://example.org/' });
  });
  it('odmietne nebezpečné a neplatné schémy aj obfuskované', () => {
    const bad = [
      'javascript:alert(1)',
      ' JaVaScRiPt:alert(1)',
      '\tjavascript:alert(1)',
      'java\nscript:alert(1)',
      'java\tscript:alert(1)',
      'jav&#x09;ascript:alert(1)',
      '\u0000javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'DATA:text/html;base64,AAAA',
      'vbscript:msgbox(1)',
      ' VBScript:x',
      'file:///etc/passwd',
      'ftp://example.org',
      'mailto:a@b.sk',
      'blob:https://example.org/x',
      'https://user:pass@example.org',
      'http://exa mple.org',
      'localhost-bez-bodky',
      'https://',
    ];
    for (const b of bad) expect(normalizeUrl(b).ok, JSON.stringify(b)).toBe(false);
  });
  it('prázdne a príliš dlhé', () => {
    expect(normalizeUrl('   ')).toEqual({ ok: false, error: 'empty' });
    expect(normalizeUrl('https://example.org/' + 'a'.repeat(500))).toEqual({ ok: false, error: 'too-long' });
  });
  it('nehodí výnimku na nestringu', () => {
    expect(normalizeUrl(undefined as unknown as string).ok).toBe(false);
  });
});

describe('widget Odkaz', () => {
  it('vykreslí odkaz s bezpečnými atribútmi a hostom', () => {
    render(<WidgetHarness type="link" config={{ title: 'Wiki', url: 'sk.wikipedia.org' }} />);
    const a = screen.getByRole('link');
    expect(a).toHaveAttribute('href', 'https://sk.wikipedia.org/');
    expect(a).toHaveAttribute('target', '_blank');
    expect(a.getAttribute('rel')).toContain('noopener');
    expect(a.getAttribute('rel')).toContain('noreferrer');
    expect(a).toHaveTextContent('Wiki');
    expect(a).toHaveTextContent('sk.wikipedia.org');
  });
  it('neplatná URL zobrazí upozornenie a žiadny odkaz', () => {
    render(<WidgetHarness type="link" config={{ url: 'javascript:alert(1)' }} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });
  it('poškodená konfigurácia nezhodí widget', () => {
    render(<WidgetHarness type="link" config={{ title: 5, url: null, accent: 'x' } as never} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
