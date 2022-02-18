import { BaseGuildTextChannel, Invite } from 'discord.js'
import { pause } from '../core/utils'

export async function checkInvitesInChannel(channel: BaseGuildTextChannel) {
  const pageOfMessages = await channel.messages.fetch({ limit: 100 })

  const messageText = pageOfMessages.map(message => message.content).join('\n')

  const lines = messageText.split('\n')

  const success: { line: string; url: string; invite: Invite }[] = []
  const failure: { line: string; url: string }[] = []

  const checked = new Set()

  for (const line of lines) {
    const inviteUrls =
      line.match(/https:\/\/discord(app)?\.(com|gg)\/[\w\/]+/g) || []

    for (const inviteUrl of inviteUrls) {
      if (checked.has(inviteUrl)) {
        continue
      }

      checked.add(inviteUrl)

      let invite = null

      try {
        invite = await channel.client.fetchInvite(inviteUrl)
      } catch (ex) {
        failure.push({
          line,
          url: inviteUrl
        })
      }

      if (invite) {
        success.push({
          invite,
          line,
          url: inviteUrl
        })
      }

      await pause(100)
    }
  }

  return {
    success,
    failure
  }
}
