# Quiz Studio

一個 Apple 風格的分段朗讀 Quiz 網站。固定使用本機儲存保存 Quiz 與作答進度。

## 功能

- 固定本機 Demo 儲存
- 主畫面分成 Main 預設題庫與 My Quiz 自建題庫，並依「第幾課」排序
- Main 預設題庫不能刪除
- 新增 Quiz：貼上固定 `quiz-json-v1` JSON 一次建立完整份
- 新增 Quiz 視窗提供「GPT 指令」，可請 ChatGPT 產生正確格式 JSON
- 每個 Part 先顯示成語/詞語教材
- 每個成語旁播放鍵朗讀 `speakText` 或 `term`，再加上 `meaning`
- 教材頁可選擇瀏覽器提供的中文語音
- 同一 Part 一次顯示整組選擇題
- 點選答案、批改、詳解、重做、Part 切換

## 本機開發

```bash
npm install
npm run dev
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

完整 GPT 產生指令已內建在新增 Quiz 視窗的「GPT 指令」按鈕中；預設 10 課題庫內建於 `lib/defaultQuizzes.json`。
