/**
 * What the queue's number actually measures.
 *
 * The score had no rubric: the enrichment prompt asked for "an integer 1-10,
 * used only to sort your queue" and said nothing about what should make it high
 * or low. Everything came back between 5 and 10, which is another way of saying
 * the column carried no information.
 *
 * The split that makes it meaningful: the **tier** answers "is this employer
 * worth an application", and the **score** answers "is this specific role a good
 * one". So company prestige is deliberately absent from the rubric below. A
 * feature-maintenance job at an S-tier company should score low and still sort
 * near the top, because those are two separate facts about it.
 */
export const FIT_RUBRIC = `Score the ROLE, not the company. Company standing is tracked separately and must not influence this number. A narrow maintenance role at a famous company scores low; an ambitious role at an unknown one scores high.

What raises the score:
- AI is the product, not a feature bolted onto it. Designing the interaction model for an AI system, not adding a chat panel to existing software.
- Ownership and scope. 0-to-1, founding-designer, first-designer-on-the-team, or end-to-end responsibility for a surface. The opposite is a feature factory executing specs handed down.
- Strategy. The role shapes what gets built and why, not only how it looks. Words like direction, roadmap, ambiguity, define, or frame.
- Leadership without a management title. Setting the craft bar, mentoring, influencing partners, leading through a cross-functional group.
- Subject match: productivity, creativity, design tools, knowledge work, consumer AI.
- Research or prototyping named as part of the work rather than handed off.

What lowers the score:
- Years required well above what they have. A req pitched several rungs up is a poor use of an application slot regardless of how good it sounds.
- Framing well below where they are. An early-career req aimed at someone with less experience is a step backwards.
- Narrow execution scope: visual polish only, design-system ticket work, localization, production art, marketing or brand design.
- Heavy management expectation, when what they want is to be doing the work.
- The posting is vague about what the team actually builds. Vagueness is information.

Anchors, so the number means the same thing across roles:
- 9-10: AI-native product, real ownership and strategic scope, years in range. Would reorder their week.
- 7-8: strong on two or three of the raising factors, nothing disqualifying.
- 5-6: a legitimate role that matches the discipline, with no particular pull.
- 3-4: off-centre. Wrong altitude, wrong scope, or years noticeably high.
- 1-2: wrong discipline, wrong level, or the posting says almost nothing.`;
