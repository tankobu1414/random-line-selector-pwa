"use strict";

// localStorageで使うキー名です。将来IndexedDBへ移行するときは、
// このキーを読み込む処理を移行スクリプトとして使えます。
const STORAGE_KEY = "random-line-selector-pwa-v1";

// 画面の状態を1か所にまとめます。DOMから毎回読み直すよりも、
// 「今どのリストを使っているか」「今の抽選結果は何か」が追いやすくなります。
let appState = loadAppData();
let currentResults = [];

const elements = {
  currentListSelect: document.querySelector("#currentListSelect"),
  currentListSummary: document.querySelector("#currentListSummary"),
  pickCountSelect: document.querySelector("#pickCountSelect"),
  pickButton: document.querySelector("#pickButton"),
  rerollButton: document.querySelector("#rerollButton"),
  resultList: document.querySelector("#resultList"),
  emptyResultMessage: document.querySelector("#emptyResultMessage"),
  removeFromResultButton: document.querySelector("#removeFromResultButton"),
  deletePickedButton: document.querySelector("#deletePickedButton"),
  itemInput: document.querySelector("#itemInput"),
  dedupeOnAdd: document.querySelector("#dedupeOnAdd"),
  addItemsButton: document.querySelector("#addItemsButton"),
  itemList: document.querySelector("#itemList"),
  itemCountText: document.querySelector("#itemCountText"),
  emptyItemsMessage: document.querySelector("#emptyItemsMessage"),
  clearItemsButton: document.querySelector("#clearItemsButton"),
  newListNameInput: document.querySelector("#newListNameInput"),
  createListButton: document.querySelector("#createListButton"),
  renameListInput: document.querySelector("#renameListInput"),
  renameListButton: document.querySelector("#renameListButton"),
  deleteListButton: document.querySelector("#deleteListButton"),
  importListNameInput: document.querySelector("#importListNameInput"),
  txtImportInput: document.querySelector("#txtImportInput"),
  exportTxtButton: document.querySelector("#exportTxtButton"),
  backupJsonButton: document.querySelector("#backupJsonButton"),
  jsonRestoreInput: document.querySelector("#jsonRestoreInput"),
  statusMessage: document.querySelector("#statusMessage"),
};

// 保存処理は関数に分けています。今はlocalStorageですが、
// IndexedDBへ変える場合はこのあたりを差し替えるだけで済む設計です。
function loadAppData() {
  const fallback = createInitialData();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    if (!isValidAppData(parsed)) {
      return fallback;
    }

    const normalized = normalizeAppData(parsed);
    // 古い文字列配列からid付き形式へ変換した結果を保存し直します。
    // これにより、次回以降は常に新しい形式で読み込めます。
    saveAppData(normalized);
    return normalized;
  } catch (error) {
    console.warn("保存データを読み込めませんでした。初期状態で開始します。", error);
    return fallback;
  }
}

function saveAppData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function createInitialData() {
  const firstId = createListId();
  return {
    version: 1,
    currentListId: firstId,
    lists: [
      {
        id: firstId,
        name: "Input",
        items: [],
      },
    ],
  };
}

function isValidAppData(data) {
  return Boolean(
    data &&
      data.version === 1 &&
      Array.isArray(data.lists) &&
      data.lists.every((list) => list && typeof list.name === "string" && Array.isArray(list.items)),
  );
}

function normalizeAppData(data) {
  const lists = data.lists.map((list) => ({
    id: typeof list.id === "string" && list.id ? list.id : createListId(),
    name: list.name.trim() || "無題のリスト",
    items: normalizeItems(list.items),
  }));

  if (lists.length === 0) {
    return createInitialData();
  }

  const currentListId = lists.some((list) => list.id === data.currentListId)
    ? data.currentListId
    : lists[0].id;

  return {
    version: 1,
    currentListId,
    lists,
  };
}

function normalizeItems(items) {
  return items
    .map((item) => {
      // 旧形式: itemsが文字列配列だった場合です。
      // 同じ文字列でも別々のidを付け、別項目として扱えるようにします。
      if (typeof item === "string") {
        const text = item.trim();
        return text ? createItem(text) : null;
      }

      // 新形式: { id, text } の形です。idが欠けているバックアップでも補完します。
      if (item && typeof item === "object" && typeof item.text === "string") {
        const text = item.text.trim();
        if (!text) {
          return null;
        }

        return {
          id: typeof item.id === "string" && item.id ? item.id : createItemId(),
          text,
        };
      }

      return null;
    })
    .filter(Boolean);
}

function createListId() {
  return createId("list");
}

function createItemId() {
  return createId("item");
}

function createId(prefix) {
  if (crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function createItem(text) {
  return {
    id: createItemId(),
    text,
  };
}

function getCurrentList() {
  return appState.lists.find((list) => list.id === appState.currentListId) || appState.lists[0];
}

function setStatus(message) {
  elements.statusMessage.textContent = message;

  window.clearTimeout(setStatus.timerId);
  setStatus.timerId = window.setTimeout(() => {
    elements.statusMessage.textContent = "";
  }, 3500);
}

function splitLines(text) {
  // Windowsの改行、Mac/Linuxの改行、スマホ貼り付け時の混在をまとめて扱います。
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function uniqueTexts(texts) {
  // 重複を除外する場合だけ使います。保存データはid付きなので、
  // 同じtextでもidが違えば別項目として扱えます。
  return [...new Set(texts)];
}

function render() {
  const currentList = getCurrentList();

  renderListSelector(currentList);
  renderItems(currentList);
  renderResults();

  elements.currentListSummary.textContent = `${currentList.name}：${currentList.items.length}件`;
  elements.renameListInput.placeholder = currentList.name;
}

function renderListSelector(currentList) {
  elements.currentListSelect.innerHTML = "";

  appState.lists.forEach((list) => {
    const option = document.createElement("option");
    option.value = list.id;
    option.textContent = `${list.name} (${list.items.length})`;
    option.selected = list.id === currentList.id;
    elements.currentListSelect.append(option);
  });
}

function renderItems(currentList) {
  elements.itemList.innerHTML = "";
  // 折りたたみの見出しに表示する件数です。
  // renderItems() は追加・削除・リスト切替・復元などのたびに呼ばれるため、
  // ここで更新すると項目数の変化にまとめて追従できます。
  elements.itemCountText.textContent = `${currentList.items.length}件`;
  elements.emptyItemsMessage.hidden = currentList.items.length > 0;

  currentList.items.forEach((item, index) => {
    const row = document.createElement("li");
    row.className = "item-row";

    const number = document.createElement("span");
    number.textContent = String(index + 1);
    number.setAttribute("aria-label", `${index + 1}番目`);

    const text = document.createElement("span");
    text.className = "item-text";
    text.textContent = item.text;

    const deleteButton = document.createElement("button");
    deleteButton.className = "button small-button";
    deleteButton.type = "button";
    deleteButton.textContent = "削除";
    deleteButton.addEventListener("click", () => deleteItemById(item.id));

    row.append(number, text, deleteButton);
    elements.itemList.append(row);
  });
}

function renderResults() {
  elements.resultList.innerHTML = "";
  elements.emptyResultMessage.hidden = currentResults.length > 0;

  currentResults.forEach((item, index) => {
    const row = document.createElement("li");
    row.className = "result-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    // 誤って一括削除しないよう、結果表示直後は未チェックにします。
    // ユーザーが自分でチェックした項目だけを操作対象にします。
    checkbox.checked = false;
    checkbox.dataset.resultId = item.id;
    checkbox.setAttribute("aria-label", `${item.text}を選択`);

    const text = document.createElement("span");
    text.className = "result-text";
    text.textContent = item.text;

    const removeButton = document.createElement("button");
    removeButton.className = "button small-button";
    removeButton.type = "button";
    removeButton.textContent = "外す";
    removeButton.addEventListener("click", () => {
      currentResults.splice(index, 1);
      renderResults();
      setStatus("結果から1件外しました。保存データは変わっていません。");
    });

    row.append(checkbox, text, removeButton);
    elements.resultList.append(row);
  });
}

function persistAndRender(message) {
  saveAppData(appState);
  render();
  if (message) {
    setStatus(message);
  }
}

function addItems() {
  const currentList = getCurrentList();
  const incomingTexts = splitLines(elements.itemInput.value);

  if (incomingTexts.length === 0) {
    setStatus("追加する項目を入力してください。");
    return;
  }

  const beforeCount = currentList.items.length;
  const textsToAdd = elements.dedupeOnAdd.checked
    ? uniqueTexts(incomingTexts).filter((text) => !currentList.items.some((item) => item.text === text))
    : incomingTexts;

  currentList.items.push(...textsToAdd.map(createItem));
  elements.itemInput.value = "";

  const addedCount = currentList.items.length - beforeCount;
  persistAndRender(`${addedCount}件追加しました。`);
}

function deleteItemById(itemId) {
  const currentList = getCurrentList();
  const beforeCount = currentList.items.length;
  currentList.items = currentList.items.filter((item) => item.id !== itemId);
  currentResults = currentResults.filter((item) => item.id !== itemId);

  if (currentList.items.length === beforeCount) {
    setStatus("削除対象が見つかりませんでした。");
    return;
  }

  persistAndRender("項目を1件削除しました。");
}

function clearCurrentItems() {
  const currentList = getCurrentList();
  if (currentList.items.length === 0) {
    setStatus("削除する項目がありません。");
    return;
  }

  const ok = confirm(`「${currentList.name}」の項目をすべて削除します。元に戻せません。`);
  if (!ok) {
    return;
  }

  currentList.items = [];
  currentResults = [];
  persistAndRender("現在のリストを空にしました。");
}

function pickRandomItems() {
  const currentList = getCurrentList();
  const count = Number(elements.pickCountSelect.value);

  if (currentList.items.length === 0) {
    currentResults = [];
    renderResults();
    setStatus("現在のリストに項目がありません。");
    return;
  }

  // 元の配列を壊さないようコピーしてからシャッフルします。
  const shuffled = [...currentList.items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // 抽選対象は全項目ですが、1回の結果内では同じtextを1回だけ表示します。
  // idは保持しているので、削除時は表示されたその1件だけを特定できます。
  const usedTexts = new Set();
  currentResults = [];
  for (const item of shuffled) {
    if (usedTexts.has(item.text)) {
      continue;
    }

    currentResults.push(item);
    usedTexts.add(item.text);

    if (currentResults.length >= count) {
      break;
    }
  }

  renderResults();
  setStatus(`${currentResults.length}件選びました。`);
}

function getCheckedResultItems() {
  const checkedIds = [...elements.resultList.querySelectorAll("input[type='checkbox']:checked")]
    .map((box) => box.dataset.resultId)
    .filter(Boolean);

  return currentResults.filter((item) => checkedIds.includes(item.id));
}

function removeCheckedResultsOnly() {
  const targets = getCheckedResultItems();
  if (targets.length === 0) {
    setStatus("外す結果にチェックを入れてください。");
    return;
  }

  const targetIds = new Set(targets.map((item) => item.id));
  currentResults = currentResults.filter((item) => !targetIds.has(item.id));
  renderResults();
  setStatus(`${targets.length}件を結果から外しました。保存データは変わっていません。`);
}

function deleteCheckedResultsFromStorage() {
  const currentList = getCurrentList();
  const targets = getCheckedResultItems();

  if (targets.length === 0) {
    setStatus("削除する結果にチェックを入れてください。");
    return;
  }

  const targetTexts = targets.map((item) => `・${item.text}`).join("\n");
  const ok = confirm(
    `次の${targets.length}件を「${currentList.name}」の保存データから削除します。\n\n${targetTexts}\n\n同じ文字列の別項目は削除しません。`,
  );
  if (!ok) {
    return;
  }

  const targetIds = new Set(targets.map((item) => item.id));
  currentList.items = currentList.items.filter((item) => !targetIds.has(item.id));
  currentResults = currentResults.filter((item) => !targetIds.has(item.id));
  persistAndRender(`${targets.length}件を保存データから削除しました。`);
}

function createList() {
  const name = elements.newListNameInput.value.trim();
  if (!name) {
    setStatus("新しいリスト名を入力してください。");
    return;
  }

  const list = {
    id: createListId(),
    name,
    items: [],
  };

  appState.lists.push(list);
  appState.currentListId = list.id;
  currentResults = [];
  elements.newListNameInput.value = "";
  persistAndRender("新しいリストを作成しました。");
}

function renameCurrentList() {
  const currentList = getCurrentList();
  const newName = elements.renameListInput.value.trim();

  if (!newName) {
    setStatus("新しいリスト名を入力してください。");
    return;
  }

  currentList.name = newName;
  elements.renameListInput.value = "";
  persistAndRender("リスト名を変更しました。");
}

function deleteCurrentList() {
  const currentList = getCurrentList();
  const ok = confirm(`リスト「${currentList.name}」を削除します。中の項目も削除されます。`);
  if (!ok) {
    return;
  }

  appState.lists = appState.lists.filter((list) => list.id !== currentList.id);

  if (appState.lists.length === 0) {
    appState = createInitialData();
  } else {
    appState.currentListId = appState.lists[0].id;
  }

  currentResults = [];
  persistAndRender("リストを削除しました。");
}

function importTxtFile(file) {
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    const texts = splitLines(String(reader.result || ""));
    const fallbackName = file.name.replace(/\.txt$/i, "") || "インポート";
    const name = elements.importListNameInput.value.trim() || fallbackName;

    if (texts.length === 0) {
      setStatus("読み込める項目がありませんでした。");
      return;
    }

    const list = {
      id: createListId(),
      name,
      // txtの同じ行も別idの別項目として読み込みます。
      items: texts.map(createItem),
    };

    appState.lists.push(list);
    appState.currentListId = list.id;
    currentResults = [];
    elements.importListNameInput.value = "";
    elements.txtImportInput.value = "";
    persistAndRender(`${texts.length}件をtxtから読み込みました。`);
  });

  reader.readAsText(file, "utf-8");
}

function exportCurrentListAsTxt() {
  const currentList = getCurrentList();
  const filename = `${sanitizeFilename(currentList.name)}.txt`;
  // txtは従来どおり「1行1項目」です。idは書き出さず、textだけを書き出します。
  downloadTextFile(filename, currentList.items.map((item) => item.text).join("\n"), "text/plain");
}

function backupAllListsAsJson() {
  const json = JSON.stringify(appState, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  downloadTextFile(`random-line-selector-backup-${date}.json`, json, "application/json");
}

function restoreFromJson(file) {
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const parsed = JSON.parse(String(reader.result || ""));
      if (!isValidAppData(parsed)) {
        throw new Error("データ形式が違います。");
      }

      const ok = confirm("JSONバックアップから復元します。現在の全リストは上書きされます。");
      if (!ok) {
        return;
      }

      // 復元データが古い文字列配列形式でも、ここでid付き形式へ変換します。
      appState = normalizeAppData(parsed);
      currentResults = [];
      elements.jsonRestoreInput.value = "";
      persistAndRender("JSONバックアップから復元しました。");
    } catch (error) {
      console.error(error);
      setStatus("JSONを復元できませんでした。バックアップファイルを確認してください。");
    }
  });

  reader.readAsText(file, "utf-8");
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "list";
}

function bindEvents() {
  elements.currentListSelect.addEventListener("change", (event) => {
    appState.currentListId = event.target.value;
    currentResults = [];
    persistAndRender("リストを切り替えました。");
  });

  elements.pickButton.addEventListener("click", pickRandomItems);
  elements.rerollButton.addEventListener("click", pickRandomItems);
  elements.removeFromResultButton.addEventListener("click", removeCheckedResultsOnly);
  elements.deletePickedButton.addEventListener("click", deleteCheckedResultsFromStorage);
  elements.addItemsButton.addEventListener("click", addItems);
  elements.clearItemsButton.addEventListener("click", clearCurrentItems);
  elements.createListButton.addEventListener("click", createList);
  elements.renameListButton.addEventListener("click", renameCurrentList);
  elements.deleteListButton.addEventListener("click", deleteCurrentList);
  elements.exportTxtButton.addEventListener("click", exportCurrentListAsTxt);
  elements.backupJsonButton.addEventListener("click", backupAllListsAsJson);

  elements.txtImportInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) {
      importTxtFile(file);
    }
  });

  elements.jsonRestoreInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) {
      restoreFromJson(file);
    }
  });
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    // ./service-worker.js のように相対パスで指定することで、
    // GitHub Pagesのサブディレクトリ配下でも動きやすくしています。
    await navigator.serviceWorker.register("./service-worker.js");
  } catch (error) {
    console.warn("Service Workerを登録できませんでした。", error);
  }
}

bindEvents();
render();
registerServiceWorker();
