import { APIApplicationCommandOption } from 'discord-api-types/v9'
import { Awaitable, CommandInteraction } from 'discord.js'
import { Bot } from '../bot'

export interface Command {
  name: string
  description: string
  hidden?: boolean
  roles: 'everyone' | 'moderators' | 'trusted'
  options?: APIApplicationCommandOption[]
  action: (bot: Bot, ctx: CommandInteraction) => Awaitable<void>
}
