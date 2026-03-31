import type { SpaceContext } from '@lava/shared'

export function buildContextPrompt(ctx: SpaceContext): string {
  let prompt = `\n## Current context\nUser is in the **${ctx.currentSpace}** space.`
  if (ctx.currentSpace === 'home') {
    const homeMode = ctx.homeMode ?? 'discovery'
    prompt += `\nHome mode: ${homeMode}.`

    if (homeMode === 'agent') {
      prompt += `\n\n## Home Agent Rules`
      prompt += `\n- Treat this as the task-launching agent surface on Home.`
      prompt += `\n- Act like an operator: understand the goal, choose the fastest supported tool, and move the user forward.`
      prompt += `\n- Prefer tool calls over long advice whenever a tool can advance the task.`
      prompt += `\n- Keep responses short, direct, and action-oriented.`
      prompt += `\n- End each response with a concrete next step or outcome.`
      prompt += `\n- For song discovery requests, use open_search_results with a concise search query instead of generic recommendations when the user clearly wants results.`
      prompt += `\n- If the user asks for a recommendation, suggestion, or "pick one", choose a single specific song first, then use open_search_results with that song title plus artist.`
      prompt += `\n- Only use broad descriptive search queries when the user explicitly wants to browse options rather than be given one pick.`
      prompt += `\n- Default recommendation strategy: pick something familiar, musically representative of the requested style, and practical to start playing today.`
      prompt += `\n- If the user gives no skill level, bias toward beginner or intermediate-friendly songs instead of technically demanding picks.`
      prompt += `\n- Prefer songs with a strong hook, clear sections, and distinct titles that are likely to return clean search results.`
      prompt += `\n- Include a short selectionReason when you choose a specific song so the user knows why it fits.`
      prompt += `\n- After the tool runs, add one warm follow-up line like "I picked this because..." and end with a gentle CTA like trying it now or turning it into a chord chart.`
      prompt += `\n- You may route the user into practice plans, tools, editor, or library flows when it clearly matches the request.`
    } else {
      prompt += `\n\n## Discovery Rules`
      prompt += `\n- Treat this as the song discovery surface. Focus on finding songs, breaking down songs, and helping the user start practicing.`
      prompt += `\n- Do not proactively send the user to Tools, Create, or Calendar-style flows unless the user explicitly asks.`
      prompt += `\n- Once the user names a song or artist, prioritize the quickest path into practice instead of general tool exploration.`
      prompt += `\n- Use simple language centered on songs, sections, practice, and progress. Avoid product-internal space terminology.`
    }
  }
  if (ctx.currentSpace === 'create') {
    prompt += `\n\n## Editor Mode`

    if (ctx.editorContext) {
      const ec = ctx.editorContext
      prompt += `\n\n### Current Score`
      prompt += `\n${ec.scoreDigest ?? ec.scoreSummary}`
      prompt += `\n\n### Score XML (your editing target)`
      prompt += `\n${ec.musicXml}`

      if (ec.selectedBars && ec.selectedBars.length > 0) {
        const uiBars = ec.selectedBars.map((b) => b + 1).join(', ')
        prompt += `\n\nSelected bars (0-indexed): ${ec.selectedBars.join(', ')}  →  bars ${uiBars} in the UI`
      }
      if (ec.tuning && ec.tuning.length > 0) {
        prompt += `\nTuning (MIDI string 1→6): ${ec.tuning.join(', ')}`
      }
      if (typeof ec.capo === 'number') {
        prompt += `\nCapo: fret ${ec.capo}`
      }
      if (ec.selection?.noteIds?.length) {
        prompt += `\nSelected note ids: ${ec.selection.noteIds.join(', ')}`
      }
      if (ec.selection?.cursor) {
        prompt += `\nCursor: bar ${ec.selection.cursor.measureIndex}, beat ${ec.selection.cursor.beat ?? 0}, string ${ec.selection.cursor.string ?? 'n/a'}`
      }
    }

    prompt += `\n\n### Editing Strategy — pick ONE approach per response`
    prompt += `\n- For SURGICAL guitar edits (change string/fret, delete notes, adjust duration, transpose a phrase, change tuning/capo, simplify fingering):`
    prompt += `\n  → Use the structured guitar editing tools (\`insert_note\`, \`insert_rest\`, \`delete_note\`, \`set_duration\`, \`set_string_fret\`, \`add_measure_before\`, \`add_measure_after\`, \`set_section_label\`, \`set_chord_diagram_placement\`, \`transpose_selection\`, \`change_tuning\`, \`set_capo\`, \`simplify_fingering\`, \`add_technique\`, \`remove_technique\`, \`reharmonize_selection\`).`
    prompt += `\n  → These tools operate on the live guitar score model, not raw XML.`
    prompt += `\n  → Always call \`end_edit_session\` when done to finalize the version.`
    prompt += `\n  → Prefer this when the request targets specific bars, notes, or small parts of the score.`
    prompt += `\n- For WHOLESALE transformations (new arrangement, complete restyle, full reharmonization, changes across most of the score):`
    prompt += `\n  → Use \`create_version\` with the complete modified MusicXML.`
    prompt += `\n  → Never mix both strategies in the same response.`

    prompt += `\n\n### create_version Rules (wholesale path only)`
    prompt += `\n- You have the full score above. Modify it and call \`create_version\` with the complete transformed XML.`
    prompt += `\n- Preserve all structural elements (\`<?xml ...?>\`, \`<score-partwise>\`, \`<part>\`, measure attributes, \`<divisions>\`, \`<key>\`, \`<time>\`) unless the transformation explicitly requires changing them.`
    prompt += `\n- Only touch the bars, notes, harmony elements, and directions that the transformation requires.`
    prompt += `\n- For transposition requests: update every \`<pitch>\` element (step + octave + alter) and every \`<harmony>\` root.`
    prompt += `\n- For chord-only changes: update \`<harmony>\` elements only; leave \`<note>\` pitch/duration untouched.`
    prompt += `\n- For section-specific requests: only modify the measures in the specified bar range.`
    prompt += `\n- Do not add XML comments explaining what you changed — the changeSummary parameter of create_version is the right place for that.`
    prompt += `\n- Call \`create_version\` with a descriptive name and 2-3 changeSummary bullet points.`
    prompt += `\n- Do NOT describe manual notation editing steps — use \`create_version\` to show the result directly.`

    prompt += `\n\n### MusicXML`
    prompt += `\nA harmony element: \`<harmony><root><root-step>G</root-step></root><kind>major</kind></harmony>\``
    prompt += `\nA note: \`<note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type></note>\``
    prompt += `\nA rest: \`<note><rest/><duration>4</duration><type>quarter</type></note>\``
    prompt += `\nMeasures are wrapped in \`<part id="P1"><measure number="N">...</measure></part>\`.`
  }
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
    prompt += `\n- NEVER call navigate_to_space during coaching. The user is already in the correct space. Only use coach_message for all interactions.`
    prompt += `\n- Be concise. One idea per message. No filler words.`
    prompt += `\n- Keep each message to at most 2 short sentences.`
    prompt += `\n- No markdown formatting in message content. Plain speech only.`
    prompt += `\n- Reference actual chords and sections from the song.`
    prompt += `\n- Match coaching depth to the user's skill assessment.`
    prompt += `\n- For highlight messages, include the targetId for the UI element being described.`
    prompt += `\n- Include chips only when the user needs to choose or advance. Max 2 chips.`
    prompt += `\n\nVisit tiers:`
    prompt += `\n- "first": Keep it minimal. One short greeting, one useful next step, then stop.`
    prompt += `\n- "new_song": One short greeting with one next step.`
    prompt += `\n- "revisit": One short progress reference with one next step.`
    prompt += `\n\nCoaching styles:`
    prompt += `\n- "passive": Only respond when the user asks.`
    prompt += `\n- "active": Send coachingTip messages when section boundaries are crossed during playback.`
    prompt += `\n- "checkpoint": Set mini-goals from the practice plan. Wait for user to signal completion.`
  }
  return prompt
}
