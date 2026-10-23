# VEX — Music Maker

A tennis soundtrack studio built with **Next.js 16, React 19, and TypeScript**, ready for Vercel. Cobalt blue, sharp white cards, black borders, crimson accents, local geometric typography, and grayscale tennis photography.

## Deploy to Vercel

1. Import this GitHub repository into Vercel. Select the **Next.js** framework; leave build and output settings at their defaults.
2. Add these **server-side** environment variables in Project Settings → Environment Variables:

   | Variable | Used for |
   | --- | --- |
   | `PIXAZO_API_KEY` | All three music models, polling, signed audio downloads |
   | `ZAI_API_KEY` | GLM 5.3 Flash prompt writing and optional web search |

3. Deploy. Redeploy after adding or changing keys. No `NEXT_PUBLIC_` keys are used. No keys are included in source, browser bundles, API responses, or browser storage.

This app is prepared for your own Vercel deployment; it is not deployed to Sites hosting. If this is a personal production tool, use Vercel Deployment Protection to control who can spend your API credits. Route handlers allow up to 300 seconds for generation and AI writing, subject to your Vercel plan's execution limits.

## Local development

Node.js 20.9 or later is required.

```sh
npm ci
cp .env.example .env.local
# Fill in your own keys in .env.local, never in tracked source.
npm run dev
```

Open the printed local URL. Without keys you can explore the entire interface, presets, and settings; generation displays a setup message. There is no simulated audio or hidden fallback provider.

```sh
npm test
npm run build
npm start
```

## Three prompt paths

- **Pick a preset:** 24 detailed hardcoded prompts, covering city pop, new jack swing, arcade funk, breakbeat, synth rock, cosmic synthwave, psychedelic surf-soul, crate-digger jazz-funk, vapor-lounge, winter bubble courts, and more. Each fits Mureka's 1,024-character limit. Picking a preset injects the full prompt into the selected music model.
- **Describe a vibe:** GLM `glm-5.3-flash` writes a model-appropriate prompt using `reasoning_effort: "high"` and enabled thinking. You can review/edit it or generate immediately. Optional web search exposes a function tool to GLM; server-side calls use zAI's `web_search` endpoint with `search-prime`. Disabling search removes all tools and performs no searches. The loop preserves provider reasoning fields and is bounded to three searches.
- **Write a prompt:** your exact text goes directly to Pixazo. Preset and direct modes never call zAI.

## Documented music controls

Reviewed against the official documentation on October 23, 2026:

| Model / documentation | Controls exposed |
| --- | --- |
| [MiniMax Music 3.0](https://www.pixazo.ai/models/minimax#text-to-music) | Prompt (1–2,000 characters), instrumental flag, lyrics, lyrics optimizer, MP3/WAV, sample rate (16/24/32/44.1 kHz), bitrate (32/64/128/256 kbps) |
| [Mureka Instrumental](https://www.pixazo.ai/models/mureka#text-to-music) | Prompt (1–1,024 characters), model version (7.6, 8, 9, **9.5** default) |
| [Stable Audio 3 Small text-to-audio](https://www.pixazo.ai/models/stable-audio) | Prompt, negative prompt, duration (1–380 seconds), inference steps (1–100), guidance (0–25), seed, MP3/WAV/FLAC/OGG/OPUS/M4A/AAC, bitrate text, prompt expansion, safety checker, synchronous output |

All three expose an optional HTTPS webhook header. MiniMax and Mureka also expose the documented `terminal` / `sync` webhook mode. Stable Audio documents only the webhook URL. Mureka's `sync_mode` only accepts false, so asynchronous mode is fixed. MiniMax and Mureka do **not** accept duration, seed, or batch controls. One generation request makes one track. MiniMax starts in instrumental mode; lyric controls are available only when you deliberately turn it off. Stable Audio prompt input has a 10,000-character application guard (the provider page does not specify a maximum).

Stable Audio's synchronous mode is exposed as requested. Large inline audio can exceed Vercel response size and localStorage limits; asynchronous output is the default and recommended choice. Provider-generated HTTPS audio links on Pixazo/R2 domains are supported, along with inline audio data URLs. New upstream media hostnames must be added to `validMediaUrl` if Pixazo changes its storage provider. Browser playback support varies by codec; downloads retain the chosen format.

Official zAI references: [Flash model](https://docs.z.ai/guides/vlm/glm-5.3-flash), [chat completions](https://docs.z.ai/api-reference/llm/chat-completion), [web search](https://docs.z.ai/api-reference/tools/web-search).

## Track lifecycle

- Submit runs on the server with your Pixazo subscription header. Jobs use the documented model-specific endpoints and universal status endpoint. Browser polling runs every 10 seconds, with no long-running polling function on Vercel. Pending jobs resume after refresh.
- `vex-undownloaded-tracks-v1` in localStorage contains undownloaded track records: exact prompt, settings, original prompt mode, AI description/search selection, webhook configuration, timestamps, job references, and audio URLs. **Remote audio files are stored by Pixazo; localStorage contains their links, not binary offline copies.** Inline synchronous audio is persisted as a data URL when browser quota permits. Quota or unavailable storage errors are shown in the interface.
- **Download** fetches the entire audio successfully before starting a browser file download. A failed fetch keeps the record. After a successful download handoff, the record leaves localStorage and remains visible in memory for the current session. The browser cannot confirm the final OS save dialog decision. Provider links can expire; download files you want to keep.
- **Remake** sends the exact saved prompt and the same model/settings, independent of the current form. No second AI call. A fixed seed can reproduce similar/identical Stable Audio output.
- **Remix** loads the saved model, every setting, prompt, prompt mode, title, AI description/search selection, preset, and webhook configuration for editing.
- Keys remain server-only. Job and download references are authenticated with HMAC signatures; download proxy requests accept only service-issued URLs on supported media hosts. Secrets are redacted from surfaced provider errors.

There is no database, account system, lootbox economy, or automatic publication to your game. This is the requested soundtrack production tool; download completed audio for your game's asset pipeline.

## Verification

The automated suite mocks paid provider calls and tests all three request contracts, prompt preservation, model limits, conditional lyrics, signed references, async completion, streamed downloads, inline audio, provider errors, localStorage filtering, GLM high reasoning, and both web-search paths. No paid generations are performed during tests. Live model generation requires your keys after deployment.

## Assets

- Tennis photograph: [Unsplash source](https://images.unsplash.com/photo-1554068865-24cecd4e34b8), downloaded locally and displayed in grayscale.
- Space Grotesk: [Google Fonts](https://github.com/google/fonts/tree/main/ofl/spacegrotesk), local variable font; license in `public/FONT-LICENSE.txt`.
- Icons: Lucide, ISC license.
