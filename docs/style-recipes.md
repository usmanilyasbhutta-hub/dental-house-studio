# Style recipes (our own)

A style recipe is the full set of choices that makes a look consistent: paper, line, how colour goes on, the order of the
drawing stages, the tool you see, and how the finished picture keeps moving. Ideas were borrowed from public "procedural
painting" and "art-style motion" skills (Claude Drawing, Huashu Art Motion); **no outside code or instructions are used**
(owner rule, see `docs/taste.md`). Recipes live in code in `src/fx/media.ts`. The `creative-director` picks from here.

## Sketch media (`type: sketch`, `style:`)

| Style | Paper | Line | Colour | Stages | Moves after | Best for | Avoid |
|---|---|---|---|---|---|---|---|
| `pencil` | light paper, fine grain | dark, wobbly, boiling | marker fill set slightly off the line | line → colour | line boils | quick tips, myth vs fact, playful | serious clinical topics |
| `watercolour` | cold-press paper, coarse texture | fine sepia liner | wet wash spreads from the middle, darker rim, granulation | colour → line | gentle sway | calm education, kids, prevention, editorial theme | lots of small details |
| `chalkboard` | dark slate board, wooden frame, smudges | grainy chalk | diagonal chalk hatching | line → colour | slight sway | "lesson" topics, step lists, back-to-school | long captions (keep 1 line) |
| `crayon` | cream paper with fibres | thick waxy, broken | waxy streaks wiped on | line → colour | line boils | children, parents, friendly offers | premium/implant topics |
| `ink` | rice paper | thick brush ink with bleed | grey ink washes | line → colour | slight sway | elegant, minimal, culture days (Iqbal Day, Eid) | colour-coded explanations |
| `risograph` | off-white, grain | riso blue | pink/blue/yellow halftone dots, misregistered | colour → line | slight sway | trendy promos, youth | fine clinical detail |
| `ukiyoe` | washi paper, wood grain | indigo key line | flat pigments with a soft top-to-bottom gradient | line → colour | slight sway | culture days, elegant education | modern tech topics |
| `midcentury` | warm paper, grain | thin brown | flat warm shapes knocked off the line | colour → line | floats | friendly promos, family | precise anatomy |
| `ligneclaire` | clean white | one even black line | bright flat colour inside the line | line → colour | none | clear "how it works" education | moody topics |
| `thickline` | light paper | very bold black, boiling | flat theme colours | line → colour | boil + sway | punchy tips, kids | premium/implant |
| `clay` | pastel lilac | barely any line | puffy pastel shapes, highlight + shadow, pop in | colour → line | floats | friendly, soft, modern | serious/clinical |
| `greasepencil` | grey paper | rough waxy dark | light scumbled colour | line → colour | boil | storyboards, "behind the scenes" | polished offers |
| `y2k` | pale blue | navy | candy colours with gloss highlights, pop in | colour → line | floats | playful offers, events | education with sources |
| `collage` | kraft card | thin dark line | cut-paper pieces drop in with shadow | colour → line | floats | promos, announcements, tactile look | clinical accuracy |

## Explainer grammars (how a video explains, not how it looks)

| Grammar | Feel | Our type |
|---|---|---|
| Whiteboard / sketch note | someone draws while explaining | `sketch` |
| Textbook diagram | precise lines, labels, cross-sections | `blueprint`, `anatomy-map` |
| Product / UI demo | objects assemble, numbered parts | `teardown` (`EffectsGallery3`), `procedure` |
| Data story | numbers grow into shapes | `DataCity`, `receipt` |
| Journey | a path leads to a place | `map-route` |
| Kinetic type | words carry the rhythm | `education`, `offer` |
| Doctor-led | real person, captions, inserts | `talking-head` |
| Front page / editorial | news-style authority | `Newspaper` (`EffectsGallery3`) |

Art styles from AI-image prompt lists that need drawn characters or 3D scenes (anime, PS1/PS2, cyberpunk anime, vinyl toy,
stop-motion clay/puppets, rubber-hose characters, dark deco, vaporwave chrome, cel-shaded noir) are **not** recipes here: they
would need generated images of people. We don't use AI-generated people or "results" (golden rule 3).

## Rules for any recipe
- One recipe per video. Don't mix media inside one video (taste N03).
- Never paint or stylise clinical photos or results; recipes are for illustrations only.
- Style imitation stays generic (watercolour, ink, chalk). Never copy a named artist's characters, a game, a show or a brand.
- New recipe: add it to `src/fx/media.ts` and to the table above, render the comparison
  (`npm run still` on the same brief with each `style`), and show the owner before using it in a real video.
