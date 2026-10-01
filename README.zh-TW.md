# bat-cowork

[English](README.md) · **繁體中文**

開發中：把 Better Agent Terminal（BAT）的桌面介面接到衍生自 [Paseo](https://github.com/getpaseo/paseo) 的 daemon，任務規則放在 daemon 裡。

**專案介紹頁：** https://teddashh.github.io/bat-cowork/?lang=zh-TW

> **這不是 Paseo 或 Better Agent Terminal 的官方版本，也不是正式發行版。** 沒有 tag、沒有簽章金鑰，也沒有自動更新。不要把它接到正式環境的 daemon 或既有的 BAT session。

這份中文說明只涵蓋 BAT Cowork 的部分。Paseo 本身的介紹、安裝與開發說明，請看 [README.md 裡未經修改的上游 README](README.md#upstream-paseo-readme-unchanged)。

## 這個 repo 是什麼

這是 Paseo 的衍生專案，基礎是 Paseo 的 commit `53ee9cd`（Paseo 0.10.0）。Paseo 的 server、client、協定與 CLI 都留在上游原本的路徑，這個 repo 另外加了：

- `apps/bat-desktop`：從 Better Agent Terminal 的 `41ea2b1` 匯入的 BAT 介面，加上一個新的 Tauri crate，使用自己的 app id，沒有自動更新。Tauri 版還編譯不過，目前是瀏覽器版能讀取本機的 daemon。
- `packages/cowork-core`：任務規則（每個任務一位主導者，旁觀者可以留言與提案）、派工規則，以及 Paseo 傳入訊息的清單。
- `packages/server/src/server/cowork`：受管 agent 的送出關卡，以及存在 `{paseoHome}/cowork/tasks.json` 的任務帳本。
- 改動七個上游 Paseo 檔案（新增 237 行，刪除 1 行），把協作程式碼接進來。

## 目前狀態

依 [docs/cowork/RELEASE-GATE.md](docs/cowork/RELEASE-GATE.md)：

| 工作包 | 狀態 | 證據 |
| --- | --- | --- |
| W0 | 已通過（accepted） | `docs/cowork/W0-REPORT.md`：Paseo 快照、upstream lock、第三方聲明與各項清單 |
| W1 | 未通過（not accepted） | 能顯示 session 與檔案，關掉客戶端後 daemon 仍在；Tauri 還編譯不過 |
| W2 | 未通過（not accepted） | 兩個本機客戶端看到同一次執行；重複的 message id 不會跑兩次；commit 落在 daemon 建立的 worktree |
| W3 | 僅本機證據（local evidence） | `task-w3.e2e.test.ts`：重做、重啟，以及追加指令 |
| W4 | 未通過（not accepted） | 兩個身分、兩個 worktree；留言會帶上 client id；旁觀者的暫停會被拒絕 |
| W5 | 未通過（not accepted） | 讀得到 commit 紀錄、任務送出紀錄與時間軸；終端機仍被拒絕 |
| W6 | 未通過（not accepted） | 舊格式的帳本能遷移，快照能還原 |

標成未通過的工作包都還不能切換上線，切換目前是關閉的。以上全部只在本機測試 daemon 上、搭配程式內的假 Claude 客戶端跑過，還沒有任何 agent 供應者（Claude、Codex、Grok）獲准派工。

## 致謝與授權

- [Paseo](https://github.com/getpaseo/paseo) 的作者是 Mohamed Boudra 與其他 Paseo 貢獻者。採用 Apache License 2.0，但第三方元件保留各自的授權，詳見 [LICENSE](LICENSE)。
- [Better Agent Terminal](https://github.com/tony1223/better-agent-terminal) 的作者是 TonyQ。匯入的介面採 MIT 授權，授權條款與版權聲明保留在 [apps/bat-desktop/BAT-LICENSE](apps/bat-desktop/BAT-LICENSE)。
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 列出上游的 commit，以及哪些有納入、哪些沒有。

專案說明（英文）：[BAT-COWORK.md](BAT-COWORK.md)。各工作包的狀態與證據：[docs/cowork/](docs/cowork/)。
