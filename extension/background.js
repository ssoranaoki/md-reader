// MD Reader — service worker（第2版 単位6: 保存したら自動で更新）
//
// ページからは、file:// の .md を読み直せなかった（実験）。content script もページと同じ制限を受ける（公式ドキュメント）。
// 拡張機能の service worker は、manifest の host_permissions に書いた相手（file:///*）なら読める。
// そこで content.js から「読み直して」と頼まれたら、ここで .md を読んで中身を返す。

const MD_FILE = /^file:\/\/\/.+\.(md|MD|markdown)$/;

// 文字コードを決めて読む。
// - res.text() はいつも UTF-8 で読むので、Shift_JIS の .md は文字化けする
// - かといって、ページが表示に使った文字コードだけを信じると、英数字だけで開いた .md
//   （実験: Playwright の Chromium では windows-1252 で表示された）に、あとから UTF-8 の日本語を書いたとき文字化けする
// そこで、まず UTF-8 として正しく読めるか試し（fatal: true なら正しくないとき TypeError。MDN）、
// だめなときだけページの文字コードで読む
function decode(buf, pageCharset) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    try {
      return new TextDecoder(pageCharset || "utf-8").decode(buf);
    } catch {
      return new TextDecoder("utf-8").decode(buf); // 知らない名前なら RangeError（MDN）
    }
  }
}

// 入れた瞬間に、MD Reader の詳細ページを開く（公開版 単位2）
// file:// で動くには、使う人が詳細ページの「ファイルの URL へのアクセスを許可する」を ON にするしかない
// （公式 Declare permissions。拡張機能から許可のダイアログは出せない）。そこで、押す場所のある画面を先に開いておく。
// 更新（update）や Chrome の更新のときは開かない。スイッチがもう ON のときも開かない
async function openDetailsIfNeeded(reason) {
  if (reason !== "install") return false;
  if (await chrome.extension.isAllowedFileSchemeAccess()) return false;
  await chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
  return true;
}
chrome.runtime.onInstalled.addListener(({ reason }) => openDetailsIfNeeded(reason));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "mdr-read") return;

  // 安全のため、頼んできたタブが今開いている .md そのものだけを読む。
  // 読む URL はメッセージからは受け取らず、Chrome が付ける送り主の情報（sender.url）だけを使う
  // （公式ドキュメント「content script に好きな URL を頼ませない」。content.js が乗っ取られても、ほかのファイルを読ませない）
  const pageUrl = (sender.url || "").split("#")[0];
  if (!MD_FILE.test(pageUrl)) {
    sendResponse({ ok: false, error: "読めるのは、今開いている .md だけです" });
    return;
  }

  fetch(pageUrl, { cache: "no-store" })
    .then((res) => res.arrayBuffer())
    .then((buf) => sendResponse({ ok: true, text: decode(buf, message.charset) }))
    .catch((err) => sendResponse({ ok: false, error: String(err) }));

  return true; // 返事をあとで（fetch が終わってから）送る、という印
});
