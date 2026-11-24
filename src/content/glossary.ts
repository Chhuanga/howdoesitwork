// One plain-English line for every CS term a beat can show as a chip.
export const glossary: Record<string, string> = {
  Graph: 'Things and the connections between them. Here: junctions and the roads that join them.',
  Node: 'One thing in a graph. Here: a junction, drawn as a dot.',
  Edge: 'One connection between two nodes. Here: a road, drawn as a line.',
  Weight: 'The cost of using an edge. Here: the minutes it takes to drive that road.',
  "Dijkstra's algorithm": 'Find the cheapest route by always finishing the closest unfinished dot next.',
  'Priority queue': 'A waiting list that always hands you its cheapest item first.',
  Greedy: 'Always taking the best-looking option right now, and never going back on it.',
};
