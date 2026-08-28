# Quiz Studio JSON 格式說明書

這份說明是給 ChatGPT 或人工建立 Quiz JSON 時使用。網站匯入後會把資料轉成標準 `quiz-json-v1` 格式。

## 最重要規則

1. 最外層必須有 `title`。
2. 必須有至少一個 Part，可寫 `sections`，也可寫 `parts` 或 `steps`。
3. 每個 Part 必須有教材與題目。
4. 成語教材必須有 `term` 與 `meaning`。
5. 按播放時會朗讀：`term，意思：meaning`。
6. 題目必須有 `prompt`、選項、正確答案。

## 標準格式

```json
{
  "schemaVersion": "quiz-json-v1",
  "title": "第一課 夏夜：成語分段朗讀選擇題",
  "category": "國文成語",
  "description": "每個 Part 先讀成語教材，再做同一 Part 的選擇題。",
  "locale": "zh-TW",
  "sections": [
    {
      "id": "step-1-star",
      "title": "STEP 1 與「星」有關的成語",
      "subtitle": "12 個星字相關成語",
      "studyItems": [
        {
          "id": "star-01",
          "type": "idiom",
          "term": "星光熠熠",
          "speakText": "星光熠熠",
          "meaning": "形容星光耀眼。",
          "reading": "熠，音ㄧˋ",
          "detail": "熠，光耀、明亮。"
        }
      ],
      "questions": [
        {
          "id": "star-q01",
          "type": "multipleChoice",
          "prompt": "形容星光耀眼。",
          "choices": [
            { "id": "A", "text": "星月交輝" },
            { "id": "B", "text": "星光熠熠" },
            { "id": "C", "text": "月明星稀" },
            { "id": "D", "text": "眾星拱月" }
          ],
          "correctChoiceId": "B",
          "explanation": "答案是 B：星光熠熠。",
          "relatedItemIds": ["star-01"]
        }
      ]
    }
  ]
}
```

## 欄位說明

### Quiz 最外層

| 欄位 | 必填 | 說明 |
| --- | --- | --- |
| `schemaVersion` | 建議 | 固定寫 `quiz-json-v1`。沒有寫也可以，網站會補上。 |
| `title` | 必填 | Quiz 標題，會顯示在主畫面卡片。 |
| `category` | 選填 | 分類，例如 `國文成語`。 |
| `description` | 選填 | Quiz 說明。 |
| `locale` | 選填 | 朗讀語言，繁中建議 `zh-TW`。 |
| `sections` | 必填 | Part 陣列。也可寫 `parts` 或 `steps`。 |

### Part / Section

| 欄位 | 必填 | 說明 |
| --- | --- | --- |
| `id` | 建議 | Part 唯一代號，例如 `step-1-star`。沒有寫會自動產生。 |
| `title` | 建議 | Part 標題，例如 `STEP 1 與「星」有關的成語`。 |
| `subtitle` | 選填 | Part 小標。 |
| `studyItems` | 必填 | 教材陣列。也可寫 `terms`、`idioms`、`vocabulary`、`words`。 |
| `questions` | 必填 | 選擇題陣列。 |

### 成語 / 詞語教材

| 欄位 | 必填 | 說明 |
| --- | --- | --- |
| `id` | 建議 | 教材唯一代號。 |
| `type` | 建議 | 成語寫 `idiom`，詞語可寫 `vocabulary` 或 `term`。 |
| `term` | 必填 | 成語或詞語本身。也可寫 `idiom`、`word`、`name`。 |
| `meaning` | 必填 | 意思。成語一定要填。 |
| `speakText` | 選填 | 要朗讀的詞。沒填就讀 `term`。 |
| `reading` | 選填 | 注音或讀音。 |
| `detail` | 選填 | 補充說明，不會被播放鍵朗讀。 |

播放規則：播放鍵會朗讀 `speakText 或 term`，再加上 `意思：meaning`。

### 選擇題

| 欄位 | 必填 | 說明 |
| --- | --- | --- |
| `id` | 建議 | 題目唯一代號。 |
| `type` | 建議 | 固定 `multipleChoice`。沒有寫成標準格式時，網站會轉成選擇題。 |
| `prompt` | 必填 | 題目文字。也可寫 `question` 或 `題目`。 |
| `choices` | 必填 | 選項陣列。也可寫 `options`。 |
| `correctChoiceId` | 必填 | 正確選項代號，例如 `B`。也可寫 `correctAnswer`、`answer`、`答案`。 |
| `explanation` | 選填 | 批改後顯示的詳解。 |
| `relatedItemIds` | 選填 | 對應教材 id。 |

## 較簡單也能匯入的寫法

網站也接受下面這種比較容易叫 ChatGPT 產生的格式：

```json
{
  "title": "測試成語 Quiz",
  "category": "國文",
  "parts": [
    {
      "title": "STEP 1 常用成語",
      "terms": [
        {
          "idiom": "畫蛇添足",
          "meaning": "比喻多此一舉，反而壞事。"
        }
      ],
      "questions": [
        {
          "question": "比喻多此一舉，反而壞事。",
          "options": {
            "A": "亡羊補牢",
            "B": "畫蛇添足",
            "C": "守株待兔",
            "D": "拔苗助長"
          },
          "correctAnswer": "B",
          "explanation": "答案是 B：畫蛇添足。"
        }
      ]
    }
  ]
}
```

## 給 ChatGPT 的產生指令

```text
請依照 Quiz Studio JSON 格式產生一份完整 Quiz。
規則：
1. 請輸出純 JSON，不要 Markdown，不要解釋。
2. 最外層要有 title、category、description、locale、sections。
3. 每個 section 要有 id、title、subtitle、studyItems、questions。
4. 每個成語 studyItem 必須有 id、type:"idiom"、term、speakText、meaning、reading、detail。
5. meaning 是必填，播放時網站會朗讀「term，意思：meaning」。
6. 每個 Part 的 questions 要一次列完整，題型是四選一。
7. 每題要有 id、type:"multipleChoice"、prompt、choices、correctChoiceId、explanation、relatedItemIds。
8. choices 請使用 A/B/C/D 四個選項。
```
