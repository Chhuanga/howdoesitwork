import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { topics, beatParams } from '../topics';
import { loadBeat, placeBeat } from '../beats';
import { glossary } from '../../content/glossary';

describe('topics and beats', () => {
  it('every beat in topics.ts has an MDX file with a question and CS terms', () => {
    for (const { topic, beat } of beatParams()) {
      const content = loadBeat(topic, beat);
      expect(content, `${topic}/${beat}`).not.toBeNull();
      expect(content!.meta.title).toBeTruthy();
      expect(content!.meta.question).toBeTruthy();
      expect(content!.meta.csTerms.length).toBeGreaterThan(0);
      expect(content!.source.length).toBeGreaterThan(20);
    }
  });

  it('every CS term a beat shows has a one-line definition', () => {
    for (const { topic, beat } of beatParams())
      for (const term of loadBeat(topic, beat)!.meta.csTerms) expect(glossary[term], term).toBeTruthy();
  });

  it('every MDX file is listed in topics.ts, so no beat is orphaned', () => {
    for (const [topic, t] of Object.entries(topics)) {
      const files = fs
        .readdirSync(path.join(process.cwd(), 'src', 'content', topic))
        .filter((f) => f.endsWith('.mdx'))
        .map((f) => f.replace('.mdx', ''));
      expect(files.sort()).toEqual([...t.beats].sort());
    }
  });

  it('works out numbering and neighbours from the order in topics.ts', () => {
    const first = loadBeat('maps', '1')!.meta;
    const last = loadBeat('maps', '2')!.meta;
    expect(first).toMatchObject({ beatNum: 1, totalBeats: 2, prevBeat: null, nextBeat: '2', topicTitle: 'Google Maps' });
    expect(last).toMatchObject({ beatNum: 2, totalBeats: 2, prevBeat: '1', nextBeat: null });
  });

  it('knows nothing about a beat that is not listed', () => {
    const data = { title: 't', question: 'q', csTerms: ['x'] };
    expect(placeBeat(data, 'maps', '99')).toBeNull();
    expect(placeBeat(data, 'nope', '1')).toBeNull();
    expect(loadBeat('maps', '99')).toBeNull();
  });
});
