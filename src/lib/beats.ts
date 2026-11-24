import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { topics } from './topics';

/** What a beat's MDX file says about itself */
export interface BeatFrontmatter {
  title: string;
  question: string;
  csTerms: string[];
  honestyNote?: string;
  /** Shown beside the locked Next button: what the learner must do to unlock it */
  unlockHint?: string;
}

/** Frontmatter plus where the beat sits in its topic, worked out from topics.ts */
export interface BeatMeta extends BeatFrontmatter {
  topicTitle: string;
  beatNum: number;
  totalBeats: number;
  prevBeat: string | null;
  nextBeat: string | null;
}

export interface BeatContent {
  meta: BeatMeta;
  /** Raw MDX source for the reveal body */
  source: string;
}

export function placeBeat(data: BeatFrontmatter, topic: string, beat: string): BeatMeta | null {
  const t = topics[topic];
  const i = t ? t.beats.indexOf(beat) : -1;
  if (!t || i < 0) return null;
  return {
    ...data,
    topicTitle: t.title,
    beatNum: i + 1,
    totalBeats: t.beats.length,
    prevBeat: t.beats[i - 1] ?? null,
    nextBeat: t.beats[i + 1] ?? null,
  };
}

export function loadBeat(topic: string, beat: string): BeatContent | null {
  const file = path.join(process.cwd(), 'src', 'content', topic, `${beat}.mdx`);
  if (!fs.existsSync(file)) return null;
  const { data, content } = matter(fs.readFileSync(file, 'utf8'));
  const meta = placeBeat(data as BeatFrontmatter, topic, beat);
  return meta ? { meta, source: content.trim() } : null;
}
