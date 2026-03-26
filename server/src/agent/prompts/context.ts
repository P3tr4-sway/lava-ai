import type { SpaceContext } from '@lava/shared'

export function buildContextPrompt(ctx: SpaceContext): string {
  let prompt = `\n## Current context\nUser is in the **${ctx.currentSpace}** space.`
  if (ctx.projectId && ctx.projectName) {
    prompt += `\nActive project: "${ctx.projectName}" (id: ${ctx.projectId})`
  } else if (ctx.projectId) {
    prompt += `\nActive project ID: ${ctx.projectId}`
  }
  if (ctx.coachContext) {
    const c = ctx.coachContext
    prompt += `\n\n## Coaching Context`
    prompt += `\nSong: "${c.songTitle}"${c.artist ? ` by ${c.artist}` : ''}`
    prompt += `\nKey: ${c.key}, Tempo: ${c.tempo} BPM, Time: ${c.timeSignature}`
    prompt += `\nSections (${c.sectionCount}): ${c.sectionLabels.join(', ')}`
    prompt += `\nChords used: ${c.chordSummary}`
    prompt += `\nUser skill: ${c.userSkillLevel ?? 'unknown'} (global)${c.songSkillAssessment ? `, ${c.songSkillAssessment} (this song)` : ''}`
    prompt += `\nCoaching style: ${c.coachingStyle}`
    prompt += `\nVisit tier: ${c.visitTier}`
    if (c.practiceProgress) {
      prompt += `\nProgress: ${c.practiceProgress.completedSessions}/${c.practiceProgress.totalSessions} sessions done`
      if (c.practiceProgress.lastSessionTitle) {
        prompt += ` (last: ${c.practiceProgress.lastSessionTitle})`
      }
      if (c.practiceProgress.nextSessionTitle) {
        prompt += ` (next: ${c.practiceProgress.nextSessionTitle})`
      }
    }

    // Coaching rules — only included when coachContext is present
    prompt += `\n\n## Coaching Rules`
    prompt += `\n- Use the coach_message tool for ALL coaching and onboarding messages. Never send plain text during coaching.`
    prompt += `\n- Be concise. One idea per message. No filler words.`
    prompt += `\n- No markdown formatting in message content. Plain speech only.`
    prompt += `\n- Reference actual chords and sections from the song.`
    prompt += `\n- Match coaching depth to the user's skill assessment.`
    prompt += `\n- For highlight messages, include the targetId for the UI element being described.`
    prompt += `\n- Include chips when the user needs to make a choice or advance.`
    prompt += `\n\nVisit tiers:`
    prompt += `\n- "first": Full onboarding. Greet with score summary, highlight UI areas one at a time, ask skill merge question, offer coaching style choice, offer practice plan.`
    prompt += `\n- "new_song": Light greeting with score summary. Offer practice plan.`
    prompt += `\n- "revisit": Reference progress. Offer to continue where they left off.`
    prompt += `\n\nCoaching styles:`
    prompt += `\n- "passive": Only respond when the user asks.`
    prompt += `\n- "active": Send coachingTip messages when section boundaries are crossed during playback.`
    prompt += `\n- "checkpoint": Set mini-goals from the practice plan. Wait for user to signal completion.`
  }
  return prompt
}
