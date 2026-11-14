# WA Export: save WhatsApp Web chats as files

> A free, open-source Firefox add-on. Select messages in WhatsApp Web, click **Export**, and get a ZIP for
> coding agents (`chat.md`, `messages.json`, `media/`), or an HTML page, PDF or image for people.
> Read-only, and everything runs on your computer.

- Install: [Add to Firefox](https://addons.mozilla.org/en-US/firefox/addon/wa-export-for-whatsapp-web/) (Firefox 140+, Firefox for Android 142+)
- Chrome: not on the Chrome Web Store yet; [build it from source](https://github.com/sivefunc/wa-export#install)
- Source: <https://github.com/sivefunc/wa-export> (MIT License)
- Website: <%SITE_URL%/>

## It lives inside WhatsApp Web.

1. **Select:** in a chat, open ⋮ → **Select messages** and tick the ones you want. Ticks you scroll past are kept.
2. **Export:** click **Export**, next to Forward. The ⚙ beside it picks the format, the order and the theme.
3. **Keep it:** one file lands in your downloads, with the photos, voice notes, videos and documents you selected.

## Looks like WhatsApp. Opens anywhere.

| Format | What you get |
|---|---|
| **HTML** | One page that looks like WhatsApp and opens in any browser. Photos, stickers, voice notes and videos play; documents download. |
| **PDF** | The same look on A4 pages. Text can be searched and copied. |
| **Image** | The same look as one PNG or JPEG. Long chats can be split into parts. |
| **ZIP** | `chat.md`, `messages.json` and `media/` with every original file. |

HTML, PDF and images follow a Light, Dark or Auto theme. PDF and images have a Quality option (Best,
Balanced, Small or a custom percentage). A real HTML export of a fictional chat:
[demo/bamboo-team.html](%SITE_URL%/demo/bamboo-team.html).

## Hand a conversation to a coding agent.

The ZIP holds the chat as Markdown and as structured JSON (`schemaVersion` 1), with every file in `media/`,
linked from where it was sent. Unzip it and point Claude Code, Codex or any agent at the folder.

```
Bamboo team-2026-10-24-1015.zip
├── chat.md
├── messages.json
└── media/
    ├── 001-photo-mockup.jpg
    ├── 002-sticker-bao.webp
    ├── 003-voice-note.ogg
    ├── 004-release-notes.pdf
    └── 005-demo-clip.mp4
```

The start of that `chat.md`:

```markdown
# WhatsApp export: Bamboo team

Exported: 2026-10-24 10:15 · 10 messages

---

## Bao the Panda — 2026-10-24 10:01

Morning! 🎋 Who's trying the **new export** today?

## You — 2026-10-24 10:02

Me! Selecting a few messages now

## Mei — 2026-10-24 10:03

Here's the mockup for v0.2

![](media/001-photo-mockup.jpg)
```

## Read-only. Local. Open source.

- It only reads, and only when you click Export. It never sends, forwards, deletes, reacts to or marks anything as read.
- Nothing goes to a server and there are no analytics. Besides web.whatsapp.com, its only permission is storage, for your settings.
- View-once media is skipped on purpose. Files WhatsApp no longer has are reported, never re-requested from the sender's phone.
- Every file it couldn't save is listed in the export itself. MIT licensed, with every line on GitHub.

Using an unofficial extension with WhatsApp is against its terms of service. This one only reads, but the
risk isn't zero. Privacy policy: <https://github.com/sivefunc/wa-export/blob/main/PRIVACY.md>

## Export your first chat.

[Add to Firefox](https://addons.mozilla.org/en-US/firefox/addon/wa-export-for-whatsapp-web/). On Chrome,
[build it from source](https://github.com/sivefunc/wa-export#install) until the Chrome Web Store listing is up.

---

Not affiliated with WhatsApp or Meta. WhatsApp is a trademark of Meta Platforms, Inc.
