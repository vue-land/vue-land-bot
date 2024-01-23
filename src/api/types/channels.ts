import {
  NewsChannel,
  StageChannel,
  TextChannel,
  ThreadOnlyChannel,
  VoiceChannel
} from 'discord.js'

export type MessageableGuildChannel =
  | NewsChannel
  | StageChannel
  | TextChannel
  | VoiceChannel
export type ThreadableGuildChannel =
  | NewsChannel
  | TextChannel
  | ThreadOnlyChannel
