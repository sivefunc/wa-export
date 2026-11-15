// Captures the README/site screenshot: WhatsApp Web in Select messages mode with the Export button and its
// settings menu open on Format, over a fictional "Bao the Panda" chat. Every real message, name and photo is
// hidden in the page first; nothing is sent. Reload the tab afterwards to restore WhatsApp.
// Usage: node scripts/live/capture-menu.mjs <light|dark> <out.png> [--menu]
// First: scripts/live/launch.mjs, open a chat you may open (opening marks it read), Select messages, tick 4.
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { CDP_URL } from "./config.mjs";

const [theme = "light", out = ".live/out/capture.png"] = process.argv.slice(2);
const withMenu = process.argv.includes("--menu");
const asset = (name, mime) => `data:${mime};base64,${readFileSync(`docs/demo/assets/${name}`).toString("base64")}`;

const browser = await chromium.connectOverCDP(CDP_URL);
const page = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().startsWith("https://web.whatsapp.com"));
if (!page) throw new Error("WhatsApp page not found");
await page.setViewportSize({ width: 1280, height: 760 });
await page.emulateMedia({ colorScheme: theme });

const result = await page.evaluate(
  ({ theme, avatar, photo }) => {
    const main = document.querySelector("#main");
    if (!main) throw new Error("no open chat");
    document.body.classList.toggle("dark", theme === "dark");
    for (let el = main; el && el !== document.documentElement; el = el.parentElement)
      for (const sib of el.parentElement?.children ?? [])
        if (sib !== el && sib.tagName !== "SCRIPT" && sib.tagName !== "STYLE" && sib.tagName !== "LINK")
          sib.style.setProperty("display", "none", "important");

    // 1. Hide everything real before anything else: other panes, real messages, header name and subtitle.
    let style = document.getElementById("wa-export-capture");
    if (!style) {
      style = document.createElement("style");
      style.id = "wa-export-capture";
      document.head.append(style);
    }
    style.textContent = `
      #main { width: 100vw !important; max-width: none !important; flex: 1 1 100% !important; }
      [data-testid="conversation-panel-messages"], [data-testid="conversation-panel-body"] > *:not(#fake-chat) { opacity: 0 !important; } /* not visibility: the extension needs the checkboxes "visible" to stay in select mode */
      #fake-chat { position: absolute; inset: 0; z-index: 5; display: flex; flex-direction: column; justify-content: flex-end;
        padding: 0 0 10px; font-size: 14.2px; line-height: 19px; }
      #fake-chat .r { position: relative; display: flex; padding: 3px 18px 3px 90px; }
      #fake-chat .r.sel { background: var(--fc-sel); }
      #fake-chat .r.out { justify-content: flex-end; }
      #fake-chat .cb { position: absolute; left: 25px; top: 50%; margin-top: -9px; width: 18px; height: 18px; border-radius: 3px;
        border: 2px solid var(--fc-cb); box-sizing: border-box; }
      #fake-chat .sel .cb { background: var(--fc-green); border-color: var(--fc-green); }
      #fake-chat .sel .cb::after { content: ""; position: absolute; left: 4px; top: 0px; width: 5px; height: 10px;
        border: solid var(--fc-check); border-width: 0 2px 2px 0; transform: rotate(45deg); }
      #fake-chat .b { max-width: 65%; border-radius: 7.5px; padding: 6px 7px 8px 9px; box-shadow: 0 1px .5px rgba(11,20,26,.13);
        background: var(--fc-in); color: var(--fc-text); }
      #fake-chat .out .b { background: var(--fc-out); }
      #fake-chat .t { float: right; margin: 8px 0 -6px 10px; font-size: 11px; color: var(--fc-time); display: inline-flex; gap: 3px; align-items: center; }
      #fake-chat .t svg { width: 16px; height: 11px; color: #53bdeb; }
      #fake-chat .b.img { padding: 3px 3px 6px; }
      #fake-chat .b.img img { display: block; width: 330px; border-radius: 6px; }
      #fake-chat .b.img .cap { padding: 6px 6px 0; }
    `;
    const vars = theme === "dark"
      ? { in: "#202c33", out: "#005c4b", text: "#e9edef", time: "rgba(233,237,239,.6)", sel: "rgba(255,255,255,.06)", cb: "#8696a0", green: "#21c063", check: "#0b141a" }
      : { in: "#ffffff", out: "#d9fdd3", text: "#111b21", time: "#667781", sel: "rgba(11,20,26,.06)", cb: "#8696a0", green: "#21c063", check: "#ffffff" };

    const header = main.querySelector("header");
    const img = header.querySelector("img");
    if (img) { img.src = avatar; img.removeAttribute("srcset"); }
    const spans = [...header.querySelectorAll("span")].filter((s) => s.children.length === 0 && s.textContent.trim());
    spans.forEach((s, i) => { if (i === 0) s.textContent = "Bao the Panda"; else s.style.display = "none"; });
    header.querySelectorAll("span[title]").forEach((t, i) => {
      if (i === 0) { t.textContent = "online"; t.removeAttribute("title"); t.style.display = ""; } else t.style.display = "none";
    });

    // 2. The fictional conversation.
    const body = main.querySelector('[data-testid="conversation-panel-body"]');
    body.style.position = "relative";
    document.getElementById("fake-chat")?.remove();
    const chat = document.createElement("div");
    chat.id = "fake-chat";
    for (const [k, v] of Object.entries(vars)) chat.style.setProperty(`--fc-${k}`, v);
    const ticks = '<svg viewBox="0 0 16 11"><path fill="currentColor" d="M11.07.65 10.06 0 4.81 6.48 2.13 3.98l-.7.74 3.48 3.26zM15.05.65 14.04 0 8.79 6.48l-1.1-1.03-.68.79 1.88 1.75z"/></svg>';
    const msgs = [
      ["in", "Hey! Did the release build pass? 🐼", "10:02", false],
      ["out", "Yes ✅ Chrome and Firefox are both green", "10:03", false],
      ["out", { photo, caption: "Mockup for v0.2 🎋" }, "10:04", false],
      ["in", "Can you send me today's notes?", "10:05", true],
      ["out", "Sure, exporting them now", "10:05", true],
      ["in", "Only the messages you select get exported, right?", "10:06", true],
      ["out", "Yes! The Export button sits next to Forward 👀", "10:06", true],
      ["in", "Perfect, thanks! 🎋", "10:07", false],
    ];
    for (const [dir, content, time, selected] of msgs) {
      const row = document.createElement("div");
      row.className = `r ${dir}${selected ? " sel" : ""}`;
      const stamp = `<span class="t">${time}${dir === "out" ? ticks : ""}</span>`;
      row.innerHTML = typeof content === "string"
        ? `<span class="cb"></span><div class="b">${content}${stamp}</div>`
        : `<span class="cb"></span><div class="b img"><img src="${content.photo}" alt=""><div class="cap">${content.caption}${stamp}</div></div>`;
      chat.append(row);
    }
    body.append(chat);

    // 3. Anything real still visible anywhere on the page? Only these texts may show outside the fake chat.
    const allowed = (t) => t === "Bao the Panda" || t === "online" || /^\d+ selected$/.test(t);
    const leakEls = [...document.body.querySelectorAll("*")]
      .filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
      .filter((e) => !e.closest("#fake-chat") && !allowed(e.textContent.trim()))
      .filter((e) => e.checkVisibility({ visibilityProperty: true, opacityProperty: true }))
      .filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.right > 0 && b.bottom > 0 && b.left < innerWidth && b.top < innerHeight; });
    const where = leakEls.map((e) => { const b = e.getBoundingClientRect(); return { tag: e.tagName, len: e.textContent.trim().length, role: e.closest("[role]")?.getAttribute("role"), tid: e.closest("[data-testid]")?.getAttribute("data-testid")?.replace(/conv-msg-.*/, "msg"), inMain: !!e.closest("#main"), rect: [b.left, b.top, b.width, b.height].map(Math.round) }; });
    const strayImages = [...document.querySelectorAll("img, video, canvas")]
      .filter((e) => !e.closest("#fake-chat") && e !== img)
      .filter((e) => e.checkVisibility({ visibilityProperty: true, opacityProperty: true }))
      .filter((e) => { const b = e.getBoundingClientRect(); return b.width > 2 && b.height > 2 && b.right > 0 && b.bottom > 0 && b.left < innerWidth && b.top < innerHeight; })
      .length;
    return { leaks: leakEls.length + strayImages, where, strayImages, dark: document.body.classList.contains("dark") };
  },
  { theme, avatar: asset("avatar-bao.jpg", "image/jpeg"), photo: asset("photo-mockup.jpg", "image/jpeg") },
);
if (result.leaks) throw new Error(`${result.leaks} real elements still visible; not capturing: ${JSON.stringify(result.where)}`);

if (withMenu) {
  const gear = page.locator("button.settings");
  if ((await gear.getAttribute("aria-expanded")) !== "true") await gear.click();
  await page.locator('[data-sub="format"]').click();
  await page.locator('[data-setting="format"][data-value="png"]').click();
  // Choosing closes the submenu; open it again so all five formats show, with PNG ticked.
  if ((await gear.getAttribute("aria-expanded")) !== "true") await gear.click();
  await page.locator('[data-sub="format"]').click();
  await page.waitForTimeout(600); // let the menu animations finish
}
const final = await page.evaluate(({ avatar }) => {
  const header = document.querySelector("#main header");
  const img = header.querySelector("img");
  if (img && img.src !== avatar) { img.src = avatar; img.removeAttribute("srcset"); }
  // Leaf text spans in reading order: the name, then the subtitle; anything else is hidden.
  const spans = [...header.querySelectorAll("span")].filter((s) => s.children.length === 0 && s.textContent.trim());
  spans.forEach((s, i) => {
    s.removeAttribute("title");
    if (i === 0) s.textContent = "Bao the Panda";
    else if (i === 1 && s.getBoundingClientRect().top > spans[0].getBoundingClientRect().top + 5) { s.textContent = "online"; s.style.display = ""; }
    else s.style.display = "none";
  });
  // No status line after WhatsApp redraws the header: centre the name in the 64px bar instead.
  const name = spans[0];
  if (name) { name.style.transform = ""; name.style.display = ""; }
  if (name && !spans.some((s) => s.textContent === "online" && s.style.display !== "none")) {
    for (let el = name.parentElement; el && el !== header; el = el.parentElement) {
      if (getComputedStyle(el).flexDirection === "column") { el.style.justifyContent = "center"; el.style.alignSelf = "stretch"; break; }
    }
  }
  const allowed = (t) => t === "Bao the Panda" || t === "online" || /^\d+ selected$/.test(t);
  const leaks = [...document.body.querySelectorAll("*")]
    .filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
    .filter((e) => !e.closest("#fake-chat") && !allowed(e.textContent.trim()))
    .filter((e) => e.checkVisibility({ visibilityProperty: true, opacityProperty: true }))
    .filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.right > 0 && b.bottom > 0 && b.left < innerWidth && b.top < innerHeight; }).length;
  const strayImages = [...document.querySelectorAll("img, video, canvas")]
    .filter((e) => !e.closest("#fake-chat") && e !== img)
    .filter((e) => e.checkVisibility({ visibilityProperty: true, opacityProperty: true }))
    .filter((e) => { const b = e.getBoundingClientRect(); return b.width > 2 && b.height > 2 && b.right > 0 && b.bottom > 0 && b.left < innerWidth && b.top < innerHeight; }).length;
  return { leaks: leaks + strayImages };
}, { avatar: asset("avatar-bao.jpg", "image/jpeg") });
if (final.leaks) throw new Error(`${final.leaks} real elements visible right before the screenshot; not capturing`);
await page.screenshot({ path: out });
console.log(JSON.stringify({ ...result, out }));
await browser.close().catch(() => {});
process.exit(0);
