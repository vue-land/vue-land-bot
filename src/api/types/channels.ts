import {
  ForumChannel,
  NewsChannel,
  TextChannel,
  VoiceChannel
} from 'discord.js'

export type MessageableGuildChannel = NewsChannel | TextChannel | VoiceChannel
export type ThreadableGuildChannel = NewsChannel | TextChannel | ForumChannel
