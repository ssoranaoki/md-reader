// MD Reader — 目次（第2版 単位5）
// content.js より先に送り込まれ、mdrToc という入れ物を用意する。
// content.js が文書を作ったあとに mdrToc.build(doc) を呼ぶと、左に「和紙のしおり」の目次ができる。
//
// しくみ
// - 見出し（h2・h3）に id を付け、目次の項目からそこへ跳べるようにする
// - スクロールのたびに、画面の上から LINE px の線より上にある、いちばん下の見出しを「今いる見出し」にする
// - 今いる見出しまで、朱色のしおりのひもを伸ばす

(() => {
  // 幅 1200px 以上では目次を常に出し、狭ければ「目次」ボタンで開く（どちらも toc.css で決める）

  const LINE = 100; // 画面の上から何 px の線より上にある見出しを「今いる見出し」にするか

  let current = null; // 今の目次（作り直すときに片付けるため）

  function build(doc) {
    destroy();

    const headings = [...doc.querySelectorAll("h2, h3")];
    if (headings.length < 2) return; // 見出しが少ない文書には目次を出さない

    // 見出しに id を付ける（文書にもともと id があれば、それを使う）
    headings.forEach((h, i) => {
      if (!h.id) h.id = `mdr-h-${i + 1}`;
    });

    // 目次を組み立てる（見出しの文字は textContent で入れるので、HTML として読まれない）
    const wrap = document.createElement("div");
    wrap.className = "md-reader-toc";
    const nav = document.createElement("nav");
    nav.className = "md-reader-toc-paper";
    nav.setAttribute("aria-label", "目次");
    const title = document.createElement("p");
    title.className = "md-reader-toc-title";
    title.textContent = "目次";
    const list = document.createElement("ol");
    const links = headings.map((h) => {
      const li = document.createElement("li");
      li.className = h.tagName === "H3" ? "lv3" : "lv2";
      const a = document.createElement("a");
      a.href = `#${h.id}`;
      a.textContent = h.textContent;
      a.addEventListener("click", () => {
        wrap.classList.remove("open");
        opener.setAttribute("aria-expanded", "false");
      });
      li.appendChild(a);
      list.appendChild(li);
      return a;
    });
    nav.append(title, list);

    const ribbon = document.createElement("div");
    ribbon.className = "md-reader-toc-ribbon";
    ribbon.setAttribute("aria-hidden", "true");
    wrap.append(nav, ribbon);

    // 狭い画面用の「目次」ボタン
    const opener = document.createElement("button");
    opener.type = "button";
    opener.className = "md-reader-toc-open";
    opener.textContent = "目次";
    opener.addEventListener("click", () => {
      const open = wrap.classList.toggle("open");
      opener.setAttribute("aria-expanded", String(open));
      // 隠れている間は長さを測れないので、開いたときにしおりのひもを測り直す
      if (open) { activeIndex = -1; pick(); }
    });
    opener.setAttribute("aria-expanded", "false");

    document.body.append(wrap, opener);
    document.documentElement.classList.add("md-reader-has-toc");

    // 今いる見出しを決める: 画面の上から LINE px の線より上にある、いちばん下の見出し
    let activeIndex = -1;
    const pick = () => {
      let idx = 0;
      headings.forEach((h, i) => {
        if (h.getBoundingClientRect().top <= LINE) idx = i;
      });
      // ページのいちばん下まで来たら、最後の見出しにする（最後の方の見出しは線まで上がってこないため）
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atBottom) idx = headings.length - 1;
      if (idx === activeIndex) return;
      activeIndex = idx;
      links.forEach((a, i) => {
        if (i === idx) a.setAttribute("aria-current", "location");
        else a.removeAttribute("aria-current");
      });
      // しおりのひもを、今いる項目の高さまで伸ばす
      const item = links[idx].parentElement;
      const end = nav.offsetTop + item.offsetTop + item.offsetHeight / 2 - nav.scrollTop;
      ribbon.style.height = `${Math.max(24, end)}px`;
    };

    // スクロールのたびに pick する（scroll の知らせは、もともと画面の描き直し1回につき1度まで。MDN）
    // ※ IntersectionObserver は、描き直しのたびに「帯に重なっているか」が前回と変わったときしか知らせないので、
    //   いちばん下へ一気に跳んだときなどに目次が付いてこなかった（実験で確認）
    const onScroll = () => pick();
    const onResize = () => { activeIndex = -1; pick(); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    nav.addEventListener("scroll", () => { activeIndex = -1; pick(); });

    current = { wrap, opener, onScroll, onResize };
    pick();
  }

  // 今いる見出しを測り直す（「元の文字」から戻したときなど、scroll が起きずに位置が変わったとき）
  function refresh() {
    if (current) current.onResize();
  }

  function destroy() {
    if (!current) return;
    window.removeEventListener("scroll", current.onScroll);
    window.removeEventListener("resize", current.onResize);
    current.wrap.remove();
    current.opener.remove();
    document.documentElement.classList.remove("md-reader-has-toc");
    current = null;
  }

  globalThis.mdrToc = { build, destroy, refresh };
})();
