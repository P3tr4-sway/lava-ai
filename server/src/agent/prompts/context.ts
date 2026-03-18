import type { SpaceContext } from '@lava/shared'

export function buildContextPrompt(ctx: SpaceContext): string {
  let prompt = `\n## Current context\nUser is in the **${ctx.currentSpace}** space.`
  if (ctx.projectId && ctx.projectName) {
    prompt += `\nActive project: "${ctx.projectName}" (id: ${ctx.projectId})`
  } else if (ctx.projectId) {
    prompt += `\nActive project ID: ${ctx.projectId}`
  }
  return prompt
}
