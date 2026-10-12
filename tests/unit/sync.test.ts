import { describe, expect, it } from 'vitest';
import { planSync } from '@/backend/sync';
import { emailToNick, nickToEmail, normalizeNick, validateNick } from '@/backend/nick';
import { mergeStudentData, toRemoteData } from '@/backend/api';
import { screenFromTemplate, TEMPLATES } from '@/templates';

const it_ = (id: string, at: number) => ({ id, at });

describe('plán synchronizácie', () => {
  it('nová lokálna plocha sa nahrá, nová vzdialená stiahne', () => {
    const p = planSync([it_('a', 10)], [it_('b', 20)], {}, []);
    expect(p.push).toEqual(['a']);
    expect(p.pull).toEqual(['b']);
  });
  it('nezmenené sa nechá; zmena len na jednej strane ide správnym smerom', () => {
    const st = { a: { remoteAt: 100, localAt: 10 }, b: { remoteAt: 100, localAt: 10 }, c: { remoteAt: 100, localAt: 10 } };
    const p = planSync([it_('a', 10), it_('b', 50), it_('c', 10)], [it_('a', 100), it_('b', 100), it_('c', 200)], st, []);
    expect(p.push).toEqual(['b']);
    expect(p.pull).toEqual(['c']);
    expect(p.conflict).toEqual([]);
  });
  it('zmena na oboch stranách je konflikt (nič sa nestratí)', () => {
    const p = planSync([it_('a', 50)], [it_('a', 200)], { a: { remoteAt: 100, localAt: 10 } }, []);
    expect(p.conflict).toEqual(['a']);
  });
  it('lokálne zmazanie sa prenesie na server, nezmazaná vzdialená sa nevzkriesi lokálne', () => {
    const p = planSync([], [it_('a', 100)], { a: { remoteAt: 100, localAt: 10 } }, ['a']);
    expect(p.deleteRemote).toEqual(['a']);
    expect(p.pull).toEqual([]);
  });
  it('zmazanie na inom zariadení odstráni nezmenenú lokálnu kópiu, ale zmenenú zachová a nahrá znova', () => {
    const st = { a: { remoteAt: 100, localAt: 10 } };
    expect(planSync([it_('a', 10)], [], st, []).deleteLocal).toEqual(['a']);
    const p = planSync([it_('a', 99)], [], st, []);
    expect(p.deleteLocal).toEqual([]);
    expect(p.push).toEqual(['a']);
  });
  it('hodiny zariadenia a servera sa nemiešajú (rôzne časové škály nevadia)', () => {
    const p = planSync([it_('a', 5)], [it_('a', 9_999_999_999_999)], { a: { remoteAt: 9_999_999_999_999, localAt: 5 } }, []);
    expect(p).toEqual({ push: [], pull: [], conflict: [], deleteRemote: [], deleteLocal: [] });
  });
});

describe('prezývka', () => {
  it('normalizuje diakritiku a veľkosť písmen', () => {
    expect(normalizeNick('  Ľubomír.Novák ')).toBe('lubomir.novak');
    expect(validateNick('Učiteľ5A')).toEqual({ ok: true, nick: 'uciten5a'.replace('uciten', 'ucitel') });
  });
  it('odmietne neplatné prezývky', () => {
    for (const bad of ['ab', 'a'.repeat(31), 'jan novak', '-jan', 'jan.', 'jan..novak', 'jan@skola', '', 'jan/x']) expect(validateNick(bad).ok, bad).toBe(false);
  });
  it('prevod nick ⇄ interný e‑mail', () => {
    expect(emailToNick(nickToEmail('jana_k'))).toBe('jana_k');
    expect(nickToEmail('jana_k')).toMatch(/^jana_k@.+\..+$/);
  });
});

describe('dáta do cloudu', () => {
  it('obrazovka sa na server posiela bez mien žiakov a bez lokálnych polí', () => {
    const s = screenFromTemplate(TEMPLATES.find((t) => t.id === 'group-work')!);
    const json = JSON.stringify(toRemoteData(s));
    expect(json).not.toContain('Katarína');
    expect(json).not.toContain('lastOpenedAt');
  });
  it('pri stiahnutí sa lokálne mená zachovajú', () => {
    const local = screenFromTemplate(TEMPLATES.find((t) => t.id === 'group-work')!);
    const remote = { ...local, widgets: JSON.parse(JSON.stringify(toRemoteData(local))).widgets };
    const merged = mergeStudentData(remote, local);
    const g = merged.widgets.find((w) => w.type === 'groups')!;
    expect((g.config as { names: string[] }).names).toContain('Katarína');
  });
});
