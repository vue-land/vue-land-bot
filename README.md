# Vue Land Bot

This is the source code for the [Vue Land Discord](https://chat.vuejs.org/) bot. It runs on Node.

## Where is all the code???

The `main` branch currently contains minimal code. All the other code is currently in PRs, ready for review.

If you want to see the code with all the features merged in, that's on [the everything branch](https://github.com/vue-land/vue-land-bot/tree/everything).

The basic skeleton for the bot is on the `base` branch. You can [review that PR here](https://github.com/vue-land/vue-land-bot/pull/1).

The other features are all in their own PRs, using the `base` branch as their target. Once the `base` branch is merged the other PRs will be updated to point at `main` instead.

## Conventions

The bot takes several conventions from [Vue](https://github.com/vuejs/core) and [Vite](https://github.com/vitejs/vite):

* `pnpm` is used as the package manager.
* The settings for Prettier are taken straight from Vue.
* `simple-git-hooks` and `lint-staged` are used to reformat the code on commit.
* The `tsconfig.json` is loosely based on Vue, though Vue has slightly different requirements from a Node bot.

## Running locally

### Prerequisites

* You'll need to install `pnpm` if you don't already have it installed.

### Running a local build

1. Clone the source from GitHub.
2. Run `pnpm install` to install the dependencies.
3. Run `pnpm build` to build the bot.
4. Run `pnpm start`. This should fail as we haven't configured the bot yet.

Create a file called `.env`, using `env.example` as an example. We'll walk through each of those settings below.

### Creating a server

You'll need a Discord server (guild) to run your bot against. You can't just run it against Vue Land during dev. If you don't have a suitable server already then you can create a new one by clicking 'Add a Server' in Discord.

There is a shared testing server that some of us use. If you're already in discussions with us about contributing to the bot (which you probably are if you've read this far) then we might be able to add you to that server. You'll need admin rights on the server, so we can't just open it up to everybody.

You should use the guild id as the `SERVER_ID` in `.env`. The guild id is the first string of 18 digits in the URL.

### Register the application

Your local bot will be seen as a separate 'application' by Discord. Registering a new application only takes a few seconds. Go to https://discord.com/developers/applications and click on 'New Application'.

That should give you an application id consisting of 18 digits. Set that as the `APPLICATION_ID` in `.env`.

An application doesn't necessarily have to include a bot, you'll need to enable a bot for your application.

Under `Settings > Bot` you should also be able to find a login token. That'll be roughly 59 characters and will be a mixture of letters, numbers and punctuation. That's the `BOT_TOKEN` in `.env`.

### Granting permissions

A bot can't just join a guild like a normal user. It needs an admin to add the application to the guild.

Go to the `Settings > OAuth2 > URL Generator`. Check the two options `bot` and `applications.commands`. You might see lots of other options in the lower box that look important, but you can actually get away without them. The bot will have the same permissions as a normal user, so you only need to check those other checkboxes to give the bot elevated permissions. The elevated permissions are used to create a role for the bot, but you can also do that manually. The only elevated permission that the bot currently needs is `Manage Roles`, which allows it to block spammers. It's up to you whether you want to check the box here or manage the bot's role manually.

Once you've picked the right permissions, the URL at the bottom of the page can be used to add the bot to your guild.

### Other settings

* The bot needs a list of roles to treat as moderators. The live bot uses `MODERATOR_ROLES=admins, moderators` but you can change that to match your test guild.
* MVPs get some special privileges too, e.g. allowing them to run some commands. The setting for that is `TRUSTED_ROLES=mvp`. Any roles in `MODERATOR_ROLES` are implicitly included.
* The bot needs a channel to post log messages. Create a suitable channel and configure its id with `LOG_CHANNEL_ID`. The id should be 18 digits and you'll find it at the end of the URL when viewing the relevant channel. You'll need to give the bot permissions to view the channel and create threads.
* The spam filter requires two more settings, `BLOCKED_ROLE` and `REPORT_SPAM_CHANNEL_ID`. The latter is used to post a public message notifying everyone that someone has been blocked. It is intended that the spammer should be able to see this message, in case it's a false alarm and they need to plead their case. The `BLOCKED_ROLE` is assigned to anyone who triggers the spam filter. You need to create that role and set permissions you think are suitable. On Vue Land it hides all the channels apart from `#report-spam` and `#admin-requests`. The bot needs to have a role granting it `Manage Roles` permissions, which should be placed above the role used to block spammers.

### Other privileges

* The bot will need permission to post messages in `#welcome`, `#related-discords` and `#how-to-get-help` for the `update-message` feature. You will need to delete any previous messages in those channels from other users, otherwise the bot won't be able to update the messages. The bot can only update or delete messages that it has posted. If you've created a new guild then you'll need to create channels with those names.

### Special channels

In addition to the channels mentioned earlier, some channel names are hard-coded into their corresponding features:

* The `jobs-channel` feature, which checks for multiple posts within 7 days, requires a channel called `#jobs`.
* `check-discord-invites` checks for invites in `#related-discords`.
* The `instruction-message` feature is currently tied to `#jobs` and `#pinia`.
* The features `update-message` and `quote` are both currently tied to the three channels `#welcome`, `#related-discords` and `#how-to-get-help`.

## Design

In general, it is possible for a single bot to run against many guilds. However, the Vue Land bot is designed to run against just a single guild. If you want to run it against another guild, you'll need to create a new 'application' (as described above) and run a separate instance of the bot.

The bot is split into a number of features. It is relatively easy to enable or disable features in the code by editing `src/index.ts`.

## Other bots

There are several other bots running on Vue Land, including:

* `VueJobs` - A bot that posts jobs from VueJobs in the `#jobs` channel.
* `zapier-vuejs-news` - Automatic notifications of Vue releases in `#announcements`.

These need to be taken into account when designing features for this bot.

## The live bot

* The live bot is currently being hosted by [skirtle](https://github.com/skirtles-code).
* The application is registered using a team account consisting of [skirtle](https://github.com/skirtles-code) and [bencodezen](https://github.com/bencodezen).

## History

This bot is based on an earlier iteration created by [Subwaytime](https://github.com/Subwaytime) and [skirtle](https://github.com/skirtles-code).

## License

MIT
