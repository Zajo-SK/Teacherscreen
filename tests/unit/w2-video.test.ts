import { describe, expect, it } from 'vitest';
import { parseStart, parseYouTube } from '@/lib/youtube';

const ID = 'dQw4w9WgXcQ';

describe('parseYouTube', () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `youtube.com/watch?v=${ID}&feature=share`,
    `https://youtu.be/${ID}`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube.com/live/${ID}`,
    `  https://youtu.be/${ID}  `,
  ])('prijme %s', (u) => {
    const r = parseYouTube(u);
    expect(r.ok && r.id).toBe(ID);
    expect(r.ok && r.embed).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/);
  });
  it('zachová čas začiatku', () => {
    const r = parseYouTube(`https://youtu.be/${ID}?t=1m30s`);
    expect(r.ok && r.start).toBe(90);
    expect(r.ok && r.embed).toContain('start=90');
  });
  it('rozpozná zoznam skladieb', () => {
    const r = parseYouTube('https://www.youtube.com/playlist?list=PLabcdefghij123');
    expect(r.ok && r.kind).toBe('playlist');
  });
  it.each([
    '',
    'javascript:alert(1)',
    'https://evil.example/watch?v=' + ID,
    `https://www.youtube.com.evil.example/watch?v=${ID}`,
    `https://user:pw@www.youtube.com/watch?v=${ID}`,
    'https://www.youtube.com/watch?v=short',
    `https://www.youtube.com/watch?v=${ID}"onload="x`,
    `https://www.youtube.com/\nwatch?v=${ID}`,
    'data:text/html,<script>1</script>',
    `https://www.youtube.com/watch?v=${ID.slice(0, 10)}<`,
  ])('odmietne %j', (u) => {
    expect(parseYouTube(u).ok).toBe(false);
  });
  it('parseStart', () => {
    expect(parseStart('90')).toBe(90);
    expect(parseStart('1h2m3s')).toBe(3723);
    expect(parseStart('abc')).toBe(0);
    expect(parseStart(null)).toBe(0);
  });
});
