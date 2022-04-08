import { Guild, Role } from 'discord.js'
import { Bot } from '../core/bot'
import { logger } from '../core/utils'

export async function getModeratorRoles(bot: Bot) {
  const moderatorRoles = await fetchRolesByNames(
    bot.guild,
    bot.config.MODERATOR_ROLES
  )

  if (moderatorRoles.length === 0) {
    logger.warn(
      'No moderator roles found, MODERATOR_ROLES may be misconfigured'
    )
  }

  return moderatorRoles
}

export async function getTrustedRoles(bot: Bot) {
  const trustedRoles = await fetchRolesByNames(
    bot.guild,
    bot.config.MODERATOR_ROLES,
    bot.config.TRUSTED_ROLES
  )

  if (trustedRoles.length === 0) {
    logger.warn(
      'No trusted roles found, MODERATOR_ROLES and TRUSTED_ROLES may be misconfigured'
    )
  }

  return trustedRoles
}

async function fetchRolesByNames(guild: Guild, ...names: string[]) {
  const roles = await guild.roles.fetch()

  const namesToMatch = []

  for (const name of names) {
    namesToMatch.push(
      ...name
        .toLowerCase()
        .split(',')
        .map(role => role.trim())
    )
  }

  const matchingRoles: Role[] = []

  for (const role of roles.values()) {
    if (
      namesToMatch.includes(role.id) ||
      namesToMatch.includes(role.name.toLowerCase())
    ) {
      matchingRoles.push(role)
    }
  }

  return matchingRoles
}
