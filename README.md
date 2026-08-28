# Quiz Studio

一個 Apple 風格的分段朗讀 Quiz 網站。使用者可用 Google 帳號登入，透過 Firebase Auth + Firestore 保存自己建立過的 Quiz，並跨裝置同步。

## 功能

- Google 登入
- Firestore 雲端保存每位使用者的 Quiz 與作答進度
- 主畫面方格卡片、搜尋、最近使用排序
- 新增 Quiz：貼上固定 `quiz-json-v1` JSON 一次建立完整份
- 每個 Part 先顯示成語/詞語教材
- 每個成語旁播放鍵朗讀 `speakText` 或 `term`，再加上 `meaning`
- 同一 Part 一次顯示整組選擇題
- 點選答案、批改、詳解、重做、Part 切換
- 未設定 Firebase 時可用本機 Demo 模式測試

## 本機開發

```bash
npm install
npm run dev
```

## 啟用 Google 登入與雲端保存

1. 到 Firebase 建立專案。
2. 啟用 Authentication，登入方式選 Google。
3. 建立 Firestore Database。
4. 複製 `.env.example` 成 `.env.local`，填入 Firebase Web App 設定。
5. 重新啟動開發伺服器。

Firestore 建議規則：

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/quizzes/{quizId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## JSON Schema 摘要

完整說明請看 `docs/quiz-json-format-guide.md`。

```json
{
  "schemaVersion": "quiz-json-v1",
  "title": "Quiz 標題",
  "category": "分類",
  "description": "說明",
  "locale": "zh-TW",
  "sections": [
    {
      "id": "step-1",
      "title": "STEP 1",
      "subtitle": "Part 說明",
      "studyItems": [
        {
          "id": "term-1",
          "type": "idiom",
          "term": "星光熠熠",
          "speakText": "星光熠熠",
          "reading": "熠，音ㄧˋ",
          "meaning": "形容星光耀眼。",
          "detail": "補充說明"
        }
      ],
      "questions": [
        {
          "id": "q1",
          "type": "multipleChoice",
          "prompt": "形容星光耀眼。",
          "choices": [
            { "id": "A", "text": "月明星稀" },
            { "id": "B", "text": "星光熠熠" }
          ],
          "correctChoiceId": "B",
          "explanation": "答案是 B：星光熠熠。",
          "relatedItemIds": ["term-1"]
        }
      ]
    }
  ]
}
```

完整範例資料已內建在首頁的「放入範例 JSON」按鈕中，也另存於 `public/demo-idiom-quiz.json`。
