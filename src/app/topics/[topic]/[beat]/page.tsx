import { MDXRemote } from 'next-mdx-remote/rsc';
import { notFound } from 'next/navigation';
import { loadBeat } from '@/lib/beats';
import { beatParams } from '@/lib/topics';
import { getInteraction } from '@/lib/interactionRegistry';
import BeatShell from '@/components/BeatShell';

export function generateStaticParams() {
  return beatParams();
}

export default async function BeatPage({
  params,
}: {
  params: Promise<{ topic: string; beat: string }>;
}) {
  const { topic, beat } = await params;

  const Interaction = getInteraction(topic, beat);
  const content = loadBeat(topic, beat);
  if (!Interaction || !content) notFound();

  return (
    <BeatShell meta={content.meta} topic={topic} reveal={<MDXRemote source={content.source} />}>
      <Interaction />
    </BeatShell>
  );
}
