import { APIApplicationCommandOption } from 'discord-api-types/v9'
import { Awaitable, ChatInputCommandInteraction } from 'discord.js'
import { Bot } from '../bot'

export interface Command {
  name: string
  description: string
  hidden?: boolean
  roles: 'everyone' | 'moderators' | 'trusted'
  options?: APIApplicationCommandOption[]
  action: (bot: Bot, ctx: ChatInputCommandInteraction) => Awaitable<unknown>
}
