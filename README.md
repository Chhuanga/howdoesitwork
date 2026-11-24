# howitworks

Teaches the computer science behind everyday apps. Tap X-ray on a real city and see the graph underneath Google Maps. Plain English first, CS term second.

Built with Next.js (App Router), TypeScript, Tailwind v4, React Three Fiber, Zustand and Vitest.

```bash
npm run dev      # http://localhost:3000
npm test         # simulation and content tests
npm run build
```

## How it fits together

| Folder | What lives there |
| --- | --- |
| `src/sim/` | Pure TypeScript, no React: the graph, Dijkstra, traffic, buildings, and the traced cities (`cities.ts`, `data/`). Unit-tested. |
| `src/scene/` | The 3D scene (React Three Fiber): roads, buildings, cars, the X-ray overlay. |
| `src/beats/<topic>/` | One interaction component per beat: the scene plus its controls. |
| `src/content/<topic>/<n>.mdx` | One file per beat: title, question, CS terms, and the reveal text. |
| `src/components/` | `SceneStage` (the one 3D canvas, mounted in the root layout and kept alive between pages), `BeatShell` (the draggable glass sheet), `Landing`, city switch, CS chip. |
| `src/lib/` | `topics.ts` (what beats exist), `interactionRegistry.tsx`, `sceneStore.ts` (what the shared scene should show), quality tier, sounds, design tokens, the city store. |

## Adding a beat

Read [docs/topic-guidelines.md](docs/topic-guidelines.md) first. It lists what every topic and beat should include, including the planned "Explain in detail" section.

1. Add its id to the topic in `src/lib/topics.ts`. Beat numbers and Back/Next links come from that order.
2. Write `src/content/<topic>/<id>.mdx`. Frontmatter: `title`, `question`, `csTerms`, and optionally `honestyNote` and `unlockHint` (what the learner must do to unlock Next).
3. Write the interaction in `src/beats/<topic>/` and add it to `src/lib/interactionRegistry.tsx`. Tell the shared scene what to show with `setScene(...)`, call `useReveal()` when the learner has seen the point, and wrap sheet controls in `<CardSlot>`. Add a line to `src/content/glossary.ts` for any new CS term.

`npm test` fails if a beat has no MDX file, or an MDX file isn't listed.

## Cities

`src/sim/cities.ts` has two real places, traced from OpenStreetMap: central New Delhi and Indiranagar, Bengaluru. Junctions, street names, road lengths and shapes, lane counts, medians, parks and water are real. Traffic is invented. The map data is © OpenStreetMap contributors (ODbL), and the app shows that credit on screen. Files in `src/sim/data/` are generated; the tools that made them are not in this repo.
