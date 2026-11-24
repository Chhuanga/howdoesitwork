// The list of topics and their beats. Plain data, so the server pages and the
// tests can both read it. To add a beat: add its id here, add its MDX file
// under src/content/<topic>/, and add its interaction in interactionRegistry.tsx.

export interface Topic {
  title: string;
  /** Beat ids, in the order learners see them */
  beats: string[];
}

export const topics: Record<string, Topic> = {
  maps: { title: 'Google Maps', beats: ['1', '2'] },
};

export function beatParams(): { topic: string; beat: string }[] {
  return Object.entries(topics).flatMap(([topic, t]) => t.beats.map((beat) => ({ topic, beat })));
}
