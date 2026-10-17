# Habit Buddy

create an app that lets me track my habits

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://habit-buddy-app-47.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f04df43c-64b6-4662-a628-d9698d13993c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Free AI fallback for Mero

If the Lovable AI gateway runs out of credits, Mero can fall back to any OpenAI-compatible
provider. The easiest free option is a Google AI Studio (Gemini API) key.

Set these as secrets for the project:

| Variable | Required | Default |
|---|---|---|
| `FALLBACK_AI_API_KEY` | yes | — |
| `FALLBACK_AI_BASE_URL` | no | `https://generativelanguage.googleapis.com/v1beta/openai/` |
| `FALLBACK_AI_MODEL` | no | `gemini-3.5-flash` |
| `FALLBACK_AI_TRANSCRIBE_MODEL` | no | same as `FALLBACK_AI_MODEL` |

With the key set, the mic button also uses this provider for speech-to-text, which is much better with
Arabic and mixed Arabic/English than the browser's built-in recognition. Without it, the mic falls back
to the browser's speech recognition (Chrome, Edge, Safari).

Note: on Google's free tier, prompts may be used to improve their models, and Mero's prompts
include your course, deadline and habit names.

## Make it yours

Tap the ✦ points pill, then **Make it yours**: dress Buddy (hats, glasses, scarf...), pick his fur color,
and change the app's accent color. Outfit items and fur colors cost points; app colors are free.
Purchases are stored as redemptions titled `Buddy item: <id>` in `reward_redemptions`, so they follow the
account. What Buddy is currently wearing and the chosen theme are kept in the browser (`localStorage`).

## Your data (Settings)

- **Calendar (.ics):** open deadlines as all-day events with a reminder the day before.
- **Full backup (JSON):** every table in one file (course photo files themselves are not included).
- **CSV:** habit history, courses and lectures, deadlines (UTF-8 with BOM so Excel shows Arabic correctly).
