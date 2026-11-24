# Topic guidelines

What every topic and beat should include. Check new topics, beats and UI ideas against this page. If an idea conflicts with it, discuss it before building.

The **Maps** topic is the reference. Its examples appear below.

## Core rules

- **Learn by doing.** Each beat asks a question, and the learner does something to unlock the answer (the reveal) and the Next button. There is no scroll-driven story in place of interaction.
- **Phone first.** Everything works by touch. Hover and cursor effects are optional extras on desktop and never the only way to reach something.
- **Plain English first, CS term second.** Explain the idea in everyday words, then name it. Every CS term shown as a chip needs a line in `src/content/glossary.ts`.
- **Don't spoil a reveal.** The landing page and earlier beats may hint at what is coming (for example, the brief X-ray scan-line glimpse on the landing page) but never show it in full.
- **Let the learner discover the idea.** Don't hand over the structure the learner is meant to find. In Maps beat 2, the waiting list stays unsorted until the learner makes 3 correct picks, and then it sorts itself to show the priority queue they found.
- **Be honest.** Numbers on screen (node and edge counts, times) are real. When the app simplifies something, say so with an `honestyNote`, for example "Real Maps uses A* and contraction hierarchies."
- **Keep the whole picture visible.** In beats, the scene is fitted so the whole graph shows on screen. Only the landing page may zoom in past the edges for drama.

## "Explain in detail" (planned, not built yet)

A deeper section in the style of [Red Blob Games](https://www.redblobgames.com/): the diagram and the code are the same thing.

### When it appears

At the end of **every beat where the algorithm reaches its answer** (in Maps, every beat that finds a route), and only after the answer is found and everything has been shown. Coming at the end, it rewards the learner and spoils nothing. Beats that only set up an idea (such as Maps beat 1, "Roads are a graph") don't get one.

### How it opens

An **Explain in detail** button appears after the reveal. On a phone, the sheet expands to half the screen and the scene stays visible above it.

### Layer 1: plain English

Connects what the learner just did to the algorithm, using their own actions. For example: "When you picked the closest waiting junction, you were popping from a priority queue."

### Layer 2: step through the code

- **Real JavaScript**, about 15 lines, with the line that is running highlighted.
- **Back / Next** replays the learner's own run (same city, start and end), so every step lands on things they already touched.
- At each step, the scene highlights the current item (in Maps, a junction) and the sheet shows the data structure's contents at that moment (in Maps, the priority queue).
- Steps are one per line of code (take from the queue, lock it in, check each neighbour, update), not one per junction. The simulation in `src/sim/` provides this trace and unit-tests it.

### Below the code

| Section | What it covers | Maps example |
| --- | --- | --- |
| Why it's correct | The short reason the algorithm gives the right answer | A locked-in junction can never be beaten by a later detour, because every other way to reach it starts from something farther away |
| Speed | How the work grows with input size: plain words first, then Big-O | O((V + E) log V), and why the priority queue makes it fast |
| Where it breaks | Inputs the algorithm can't handle. Mention them only; they aren't played out as a challenge | Negative road times, and why Maps never has them |
| How the real app does it | How the real product goes beyond the beat, expanding the `honestyNote` | A*, contraction hierarchies, live traffic, and why plain Dijkstra is too slow for a whole country |

### Not planned for now

These were considered and left out. Revisit them later if they fit:

- Racing algorithms against each other on the same scene (e.g. BFS vs Dijkstra vs Greedy vs A*)
- "Try to break it" challenges
- Copyable or runnable code outside the step-through

## Checklist for a new topic

- [ ] Every beat has a question, an interaction that unlocks the reveal, and an `unlockHint`
- [ ] Works fully by touch on a phone
- [ ] Reveal text is plain English first, and each CS term has a glossary line
- [ ] Nothing on the landing page or earlier beats gives away a later reveal
- [ ] Numbers shown are real, and simplifications have an `honestyNote`
- [ ] Each beat where the algorithm reaches its answer has an **Explain in detail** section with both layers and all four sections below the code
