// MD Reader — content script（単位2: Markdown を HTML にして表示する／単位3: コードの色分け／単位4: 元の文字ボタン／
//                            単位5: 目次／単位6: 保存したら自動で更新）
//
// Chrome は file:// の .md を <body><pre>…元の文字…</pre></body> の形で見せる。
// 1. <pre> から元の Markdown を取り出す
// 2. marked で HTML に変える
// 3. DOMPurify で危ない部分（<script>、onerror= など）を取り除く
// 4. 元の <pre> は隠して残し（単位4の「元の文字に戻す」で使う）、変換した文書を表示する
// 5. 1.5秒ごとに service worker（background.js）に .md を読み直してもらい、変わっていたら 2〜4 をやり直す

(() => {
  const pre = document.querySelector("body > pre");
  if (!pre) {
    console.log("[MD Reader] <pre> が見つかりません。中身の形:", document.body.innerHTML.slice(0, 200));
    return;
  }

  const doc = document.createElement("article");
  doc.className = "md-reader-doc";

  // Markdown の文字から、文書・色分け・目次・タブの名前を作る（自動更新のたびに呼び直す）
  const render = (source) => {
    // marked は安全化をしない（公式 README の警告）。必ず DOMPurify を通してから使う
    const unsafeHtml = marked.parse(source);
    const safeHtml = DOMPurify.sanitize(unsafeHtml);
    doc.innerHTML = safeHtml;

    // コードの色分け（単位3）。marked は ```js を <pre><code class="language-js"> にするので、
    // highlight.js はその目印で言語を知る。目印が無いときは言語を自動で推測する
    for (const block of doc.querySelectorAll("pre code")) {
      hljs.highlightElement(block);
    }

    // 目次（第2版 単位5）。toc.js が用意した mdrToc で、左に「和紙のしおり」の目次を作る
    mdrToc.build(doc);

    // タブの名前を、最初の見出しにする（無ければファイル名のまま）
    const h1 = doc.querySelector("h1");
    if (h1) document.title = h1.textContent;
  };

  // 先にページに入れてから作る（目次は、見出しがページに入っていないと位置を測れない）
  let source = pre.textContent;
  pre.hidden = true;
  document.body.prepend(doc);
  document.documentElement.classList.add("md-reader");
  render(source);

  // 「元の文字」ボタン（単位4）。隠して残した <pre> と、変換した文書を入れ替える
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "md-reader-toggle";
  let showingRaw = false;
  let stale = false; // 「元の文字」を見ている間に .md が変わり、文書をまだ描き直していない
  const update = () => {
    pre.hidden = !showingRaw;
    doc.hidden = showingRaw;
    document.documentElement.classList.toggle("md-reader", !showingRaw);
    toggle.textContent = showingRaw ? "読みやすく表示" : "元の文字";
    toggle.title = showingRaw ? "MD Reader の表示に戻す" : "元の Markdown の文字を表示する";
  };
  toggle.addEventListener("click", () => {
    showingRaw = !showingRaw;
    update();
    if (showingRaw) return;
    // 文書が見えるようになってから描き直す・測り直す（隠れた見出しは位置を測れない）
    if (stale) {
      stale = false;
      render(source);
    } else {
      mdrToc.refresh(); // 戻すと scroll が起きずに位置が変わることがある
    }
  });
  update();
  document.body.append(toggle);

  // 「更新しました」の小さな知らせ（単位6）
  const notice = document.createElement("div");
  notice.className = "md-reader-notice";
  notice.setAttribute("role", "status");
  document.body.append(notice);
  let noticeTimer = 0;
  const showNotice = () => {
    notice.textContent = "更新しました";
    notice.classList.add("show");
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => notice.classList.remove("show"), 1600);
  };

  // 保存したら自動で更新（単位6）
  // ファイルの改行は CRLF（Windows）のこともあるが、ページの <pre> に入った文字は LF にそろっている。比べる前にそろえる
  const normalize = (text) => text.replace(/\r\n?/g, "\n");
  let busy = false;
  let warned = false;
  // service worker に読み直してもらう。どのファイルかは伝えない（service worker が「頼んできたタブの URL」を自分で見る）。
  // 伝えるのは、ページが表示に使った文字コードだけ（Shift_JIS の .md のため）
  const read = async () => {
    const res = await chrome.runtime.sendMessage({ type: "mdr-read", charset: document.characterSet });
    if (!res || !res.ok) {
      if (!warned) console.log("[MD Reader] 読み直せませんでした:", res && res.error);
      warned = true;
      return null;
    }
    return normalize(res.text);
  };
  const SETTLE_MS = 300; // 変わったと見えたら、これだけ待ってもう一度読む
  const check = async () => {
    if (busy || document.hidden) return; // 前の読み直しが終わっていない、またはタブが見えていない
    busy = true;
    try {
      const next = await read();
      if (next === null || next === source) return; // 読めない、または変わっていない
      // エディタが書いている途中（空・途中まで）を読んだかもしれない。少し待って読み直し、同じなら書き終わったとみなす
      await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
      if ((await read()) !== next) return; // まだ書いている途中。次の見回りでもう一度
      source = next;
      pre.textContent = source; // 「元の文字」も新しくする
      if (showingRaw) {
        stale = true; // 文書が隠れている間は描き直さない（見出しの位置を測れない）。戻したときに描き直す
      } else {
        const y = window.scrollY; // 読んでいた場所を覚えておく
        render(source);
        window.scrollTo({ top: y, behavior: "instant" });
      }
      showNotice();
      console.log("[MD Reader] 更新しました:", source.length, "文字");
    } catch (err) {
      // 拡張機能が再読み込みされた後などは、もう頼めない。見張りをやめる
      clearInterval(timer);
      console.log("[MD Reader] 自動更新を止めました:", String(err));
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(check, 1500);

  console.log("[MD Reader] 表示しました:", source.length, "文字");
})();
