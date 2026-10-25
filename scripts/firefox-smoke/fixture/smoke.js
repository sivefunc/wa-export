// Firefox content-script behaviors unit tests can't reproduce. Result goes to document.title.
(async () => {
  const out = {};
  try {
    // Bytes from the page world, the way the MAIN-world bridge sends media.
    const pageBuffer = await new Promise((resolve) => {
      const script = document.createElement("script");
      script.textContent = `window.postMessage({ k: "wa-export-smoke", b: new Uint8Array(3e6).fill(7).buffer }, "*")`;
      const onMessage = (e) => {
        if (e.data?.k !== "wa-export-smoke") return;
        removeEventListener("message", onMessage);
        resolve(e.data.b);
      };
      addEventListener("message", onMessage);
      document.documentElement.append(script);
    });
    const path = "media/001-video.mp4";
    const record = {
      id: "A", fromMe: true, type: "video", timestamp: 1792845000, sender: { jid: null, name: null }, text: "",
      quoted: null, quotedUnavailable: false, isViewOnce: false, isForwarded: false, problems: [],
      media: { kind: "video", mime: "video/mp4", filename: null, size: 3e6, durationSec: 46 },
      exportedMedia: { path, mime: "video/mp4", filename: null, size: 3e6, source: "wa-js" },
    };
    const bundle = { chat: { jid: null, name: "Smoke" }, exportedAt: new Date(), records: [record], media: new Map([[path, new Blob([pageBuffer])]]), problems: [] };
    let last = -1;
    const written = await Promise.race([
      globalThis.__waExportGetWriter("zip").write(bundle, (pct) => (last = pct)),
      new Promise((resolve) => setTimeout(() => resolve(null), 15000)),
    ]);
    out.zip = written ? { ok: written.blob.size > 3e6, progress: last } : { ok: false, stuckAt: last };

    // The HTML writer reads the same page bytes to base64-encode them.
    let lastHtml = -1;
    const html = await Promise.race([
      globalThis.__waExportGetWriter("html").write(bundle, (pct) => (lastHtml = pct)),
      new Promise((resolve) => setTimeout(() => resolve(null), 15000)),
    ]);
    out.html = html
      ? { ok: html.filename.endsWith(".html") && html.blob.size > 4e6 && (await html.blob.text()).includes('data-for="m1"'), progress: lastHtml }
      : { ok: false, stuckAt: lastHtml };

    // PNG, JPEG and PDF of the demo chat, with every file handed over from the page world like real media.
    const pageAssets = await new Promise((resolve) => {
      const script = document.createElement("script");
      script.textContent = `(() => {
        const assets = ${JSON.stringify(globalThis.__waDemoAssets)};
        const out = {};
        for (const [k, v] of Object.entries(assets)) out[k] = Uint8Array.from(atob(v), (c) => c.charCodeAt(0)).buffer;
        window.postMessage({ k: "wa-export-assets", out }, "*");
      })()`;
      const onMessage = (e) => {
        if (e.data?.k !== "wa-export-assets") return;
        removeEventListener("message", onMessage);
        resolve(e.data.out);
      };
      addEventListener("message", onMessage);
      document.documentElement.append(script);
    });
    const demo = () => globalThis.__waDemoChatFrom((name, mime) => new Blob([pageAssets[name]], { type: mime }));
    const SIGNATURES = { png: [0x89, 0x50, 0x4e, 0x47], jpeg: [0xff, 0xd8, 0xff], pdf: [0x25, 0x50, 0x44, 0x46] };
    for (const id of ["png", "jpeg", "pdf"]) {
      let pct = -1;
      const t0 = performance.now();
      const res = await Promise.race([
        globalThis.__waExportGetWriter(id).write(demo(), (p) => (pct = p), { format: id, order: "date", longImages: "single" }),
        new Promise((resolve) => setTimeout(() => resolve(null), 30000)),
      ]);
      if (!res) { out[id] = { ok: false, stuckAt: pct }; continue; }
      const head = new Uint8Array(await res.blob.slice(0, 4).arrayBuffer());
      const ok = SIGNATURES[id].every((b, i) => head[i] === b) && res.blob.size > 20000 && pct === 100;
      out[id] = { ok, kb: Math.round(res.blob.size / 1024), ms: Math.round(performance.now() - t0), name: res.filename };
      // Saved next to the smoke download, so WA_EXPORT_SMOKE_OUT can keep them for a look.
      const a = document.createElement("a");
      a.href = URL.createObjectURL(res.blob);
      a.download = `demo-${id}.${{ png: "png", jpeg: "jpg", pdf: "pdf" }[id]}`;
      document.documentElement.append(a);
      a.click();
      a.remove();
    }

    // Same as src/ui/save.ts: an <a download> click from the content script.
    const url = URL.createObjectURL(new Blob(["smoke"], { type: "application/zip" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "wa-export-smoke.zip";
    document.documentElement.append(a);
    a.click();
    a.remove();
  } catch (err) {
    out.error = String(err);
  }
  document.title = "WA-EXPORT-SMOKE " + JSON.stringify(out);
})();
