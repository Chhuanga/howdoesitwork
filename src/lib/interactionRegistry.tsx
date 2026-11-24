import type { ComponentType } from 'react';
import Beat1Interaction from '@/beats/maps/Beat1Interaction';
import Beat2Interaction from '@/beats/maps/Beat2Interaction';

// One entry per beat, matching the ids in topics.ts. Each interaction draws the
// scene and, through <CardSlot>, any controls that belong in the card.
const registry: Record<string, Record<string, ComponentType>> = {
  maps: {
    '1': Beat1Interaction,
    '2': Beat2Interaction,
  },
};

export function getInteraction(topic: string, beat: string): ComponentType | null {
  return registry[topic]?.[beat] ?? null;
}
