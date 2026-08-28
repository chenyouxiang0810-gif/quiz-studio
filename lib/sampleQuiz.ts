import type { ChoiceId, QuizDocument, QuizQuestion, StudyItem } from './quizTypes';

function mc(
  id: string,
  prompt: string,
  choices: string[],
  correctChoiceId: ChoiceId,
  relatedItemId: string,
): QuizQuestion {
  const ids = ['A', 'B', 'C', 'D'];
  const correctText = choices[ids.indexOf(correctChoiceId)];
  return {
    id,
    type: 'multipleChoice',
    prompt,
    choices: choices.map((text, index) => ({ id: ids[index], text })),
    correctChoiceId,
    explanation: `答案是 ${correctChoiceId}：${correctText}。`,
    relatedItemIds: [relatedItemId],
  };
}

const starItems: StudyItem[] = [
  { id: 'star-01', type: 'idiom', term: '星光熠熠', speakText: '星光熠熠', reading: '熠，音ㄧˋ', meaning: '形容星光耀眼。', detail: '熠，光耀、明亮。' },
  { id: 'star-02', type: 'idiom', term: '月明星稀', speakText: '月明星稀', meaning: '月色皎潔，星光稀疏不明。', detail: '形容清朗幽靜的月夜。' },
  { id: 'star-03', type: 'idiom', term: '眾星拱月', speakText: '眾星拱月', meaning: '很多星星聚集，圍著月亮。', detail: '比喻許多人共同簇擁一個人。' },
  { id: 'star-04', type: 'idiom', term: '星羅棋布', speakText: '星羅棋布', meaning: '形容布列繁密。', detail: '如星星、棋子般的廣泛分布。' },
  { id: 'star-05', type: 'idiom', term: '披星戴月', speakText: '披星戴月', meaning: '形容早出晚歸，旅途勞累。' },
  { id: 'star-06', type: 'idiom', term: '星月交輝', speakText: '星月交輝', meaning: '星辰與月亮的光芒相互輝映。' },
  { id: 'star-07', type: 'idiom', term: '福星高照', speakText: '福星高照', meaning: '好運當頭。' },
  { id: 'star-08', type: 'idiom', term: '星火燎原', speakText: '星火燎原', reading: '燎，音ㄌㄧㄠˊ', meaning: '小火苗可以引起燎原大火。比喻細小事故能釀成大禍，或微小的力量可以發展成強大的勢力。', detail: '燎，燃燒。' },
  { id: 'star-09', type: 'idiom', term: '物換星移', speakText: '物換星移', meaning: '事物改換，星辰移動。', detail: '比喻景物的變遷、世事的更替。' },
  { id: 'star-10', type: 'idiom', term: '急如星火', speakText: '急如星火', meaning: '如流星的光那樣急速。', detail: '形容情勢十分緊急。' },
  { id: 'star-11', type: 'idiom', term: '滿眼金星', speakText: '滿眼金星', meaning: '形容視力昏眩迷亂的樣子。' },
  { id: 'star-12', type: 'idiom', term: '寥若晨星', speakText: '寥若晨星', reading: '寥，音ㄌㄧㄠˊ', meaning: '稀少得像早晨的星星。', detail: '形容數量稀少。寥，稀疏。' },
];

const sleepItems: StudyItem[] = [
  { id: 'sleep-01', type: 'idiom', term: '昏昏欲睡', speakText: '昏昏欲睡', meaning: '精神恍惚很想睡覺。', detail: '形容非常疲累。' },
  { id: 'sleep-02', type: 'idiom', term: '鼾聲如雷', speakText: '鼾聲如雷', reading: '鼾，音ㄏㄢ', meaning: '睡覺時鼾聲如雷。', detail: '形容熟睡的樣子。' },
  { id: 'sleep-03', type: 'idiom', term: '如夢初醒', speakText: '如夢初醒', meaning: '好像從睡夢中剛醒過來。', detail: '比喻從糊塗、錯誤的認識中恍然大悟。' },
  { id: 'sleep-04', type: 'idiom', term: '睡眼惺忪', speakText: '睡眼惺忪', reading: '惺忪，音ㄒㄧㄥ ㄙㄨㄥ', meaning: '形容人剛睡醒，神智模糊，眼神迷茫的樣子。', detail: '惺忪，剛睡醒，眼睛模糊不清的樣子。' },
  { id: 'sleep-05', type: 'idiom', term: '昏昏靡靡', speakText: '昏昏靡靡', reading: '靡，音ㄇㄧˇ', meaning: '形容想睡覺、神智不清的樣子。', detail: '亦作「惛惛罔罔」。' },
  { id: 'sleep-06', type: 'idiom', term: '寢不安席', speakText: '寢不安席', meaning: '睡覺時不安於枕席。', detail: '形容有心事而睡不安穩。' },
  { id: 'sleep-07', type: 'idiom', term: '南柯一夢', speakText: '南柯一夢', meaning: '淳于棼夢中成為南柯郡太守，醒來發現一切夢境發生於槐樹旁蟻穴。', detail: '比喻人生如夢，富貴得失無常。' },
  { id: 'sleep-08', type: 'idiom', term: '黃粱一夢', speakText: '黃粱一夢', meaning: '盧生夢見享盡榮華富貴，醒來時店主人蒸的黃粱尚未熟。', detail: '比喻富貴榮華如夢一般，短促而虛幻；亦比喻不切實際的空想。' },
];

const summerItems: StudyItem[] = [
  { id: 'summer-01', type: 'idiom', term: '烈日當空', speakText: '烈日當空', meaning: '炎熱的太陽高掛天空。', detail: '形容天氣酷熱。' },
  { id: 'summer-02', type: 'idiom', term: '炎陽炙人', speakText: '炎陽炙人', reading: '炙，音ㄓˋ', meaning: '指炎熱的太陽照射在身上，好像烤火一般熱。', detail: '形容非常酷熱。炙，烤。' },
  { id: 'summer-03', type: 'idiom', term: '流金鑠石', speakText: '流金鑠石', reading: '鑠，音ㄕㄨㄛˋ', meaning: '形容天氣非常炎熱，好像能把金、石熔化。', detail: '鑠，熔化。' },
  { id: 'summer-04', type: 'idiom', term: '火傘高張', speakText: '火傘高張', meaning: '比喻烈日當空。' },
  { id: 'summer-05', type: 'idiom', term: '揮汗如雨', speakText: '揮汗如雨', meaning: '抹下的汗水如同下雨一般。', detail: '比喻流汗很多。亦作「揮汗成雨」。' },
];

export const sampleQuiz: QuizDocument = {
  schemaVersion: 'quiz-json-v1',
  title: '第一課 夏夜：成語分段朗讀選擇題',
  category: '國文成語',
  locale: 'zh-TW',
  description: '每個 Part 先讀成語教材，播放按鈕會朗讀「成語，意思：內容」，接著一次完成同一 Part 的選擇題。',
  createdBy: 'ChatGPT demo',
  sections: [
    {
      id: 'step-1-star',
      title: 'STEP 1 與「星」有關的成語',
      subtitle: '12 個星字相關成語',
      order: 1,
      studyItems: starItems,
      questions: [
        mc('star-q01', '形容星光耀眼。', ['星月交輝', '星光熠熠', '月明星稀', '眾星拱月'], 'B', 'star-01'),
        mc('star-q02', '形容清朗幽靜的月夜。', ['月明星稀', '披星戴月', '福星高照', '星羅棋布'], 'A', 'star-02'),
        mc('star-q03', '比喻許多人共同簇擁一個人。', ['物換星移', '星火燎原', '眾星拱月', '滿眼金星'], 'C', 'star-03'),
        mc('star-q04', '形容布列繁密，如星星、棋子般廣泛分布。', ['星羅棋布', '寥若晨星', '星月交輝', '急如星火'], 'A', 'star-04'),
        mc('star-q05', '形容早出晚歸，旅途勞累。', ['福星高照', '披星戴月', '物換星移', '月明星稀'], 'B', 'star-05'),
        mc('star-q06', '星辰與月亮的光芒相互輝映。', ['星光熠熠', '眾星拱月', '星月交輝', '星火燎原'], 'C', 'star-06'),
        mc('star-q07', '形容好運當頭。', ['滿眼金星', '福星高照', '急如星火', '披星戴月'], 'B', 'star-07'),
        mc('star-q08', '比喻微小的力量可以發展成強大的勢力。', ['星羅棋布', '物換星移', '星火燎原', '寥若晨星'], 'C', 'star-08'),
        mc('star-q09', '比喻景物的變遷、世事的更替。', ['物換星移', '眾星拱月', '月明星稀', '星月交輝'], 'A', 'star-09'),
        mc('star-q10', '形容情勢十分緊急。', ['披星戴月', '急如星火', '福星高照', '星光熠熠'], 'B', 'star-10'),
        mc('star-q11', '形容視力昏眩迷亂的樣子。', ['寥若晨星', '星羅棋布', '滿眼金星', '星火燎原'], 'C', 'star-11'),
        mc('star-q12', '形容數量非常稀少。', ['眾星拱月', '月明星稀', '寥若晨星', '物換星移'], 'C', 'star-12'),
      ],
    },
    {
      id: 'step-2-sleep',
      title: 'STEP 2 與「睡眠」有關的成語',
      subtitle: '8 個睡眠與夢境相關成語',
      order: 2,
      studyItems: sleepItems,
      questions: [
        mc('sleep-q01', '形容精神恍惚、非常疲累，很想睡覺。', ['睡眼惺忪', '昏昏欲睡', '寢不安席', '南柯一夢'], 'B', 'sleep-01'),
        mc('sleep-q02', '形容睡覺時鼾聲很大、熟睡的樣子。', ['鼾聲如雷', '如夢初醒', '昏昏靡靡', '黃粱一夢'], 'A', 'sleep-02'),
        mc('sleep-q03', '比喻從糊塗或錯誤的認識中恍然大悟。', ['南柯一夢', '寢不安席', '如夢初醒', '昏昏欲睡'], 'C', 'sleep-03'),
        mc('sleep-q04', '形容剛睡醒，神智模糊、眼神迷茫。', ['黃粱一夢', '睡眼惺忪', '鼾聲如雷', '寢不安席'], 'B', 'sleep-04'),
        mc('sleep-q05', '形容想睡覺、神智不清的樣子。', ['如夢初醒', '南柯一夢', '昏昏靡靡', '睡眼惺忪'], 'C', 'sleep-05'),
        mc('sleep-q06', '形容有心事而睡不安穩。', ['寢不安席', '鼾聲如雷', '昏昏欲睡', '黃粱一夢'], 'A', 'sleep-06'),
        mc('sleep-q07', '比喻人生如夢，富貴得失無常。', ['睡眼惺忪', '南柯一夢', '如夢初醒', '昏昏靡靡'], 'B', 'sleep-07'),
        mc('sleep-q08', '比喻富貴榮華短促虛幻，也可指不切實際的空想。', ['寢不安席', '鼾聲如雷', '黃粱一夢', '昏昏欲睡'], 'C', 'sleep-08'),
      ],
    },
    {
      id: 'step-3-summer',
      title: 'STEP 3 與「夏日」有關的成語',
      subtitle: '5 個炎熱夏日相關成語',
      order: 3,
      studyItems: summerItems,
      questions: [
        mc('summer-q01', '炎熱的太陽高掛天空，形容天氣酷熱。', ['烈日當空', '揮汗如雨', '火傘高張', '流金鑠石'], 'A', 'summer-01'),
        mc('summer-q02', '形容炎熱的太陽照在身上，好像烤火一般熱。', ['流金鑠石', '炎陽炙人', '烈日當空', '揮汗如雨'], 'B', 'summer-02'),
        mc('summer-q03', '形容天氣非常炎熱，好像能把金、石熔化。', ['火傘高張', '烈日當空', '流金鑠石', '炎陽炙人'], 'C', 'summer-03'),
        mc('summer-q04', '比喻烈日當空。', ['揮汗如雨', '炎陽炙人', '流金鑠石', '火傘高張'], 'D', 'summer-04'),
        mc('summer-q05', '比喻流汗很多。', ['揮汗如雨', '火傘高張', '烈日當空', '炎陽炙人'], 'A', 'summer-05'),
      ],
    },
  ],
};
