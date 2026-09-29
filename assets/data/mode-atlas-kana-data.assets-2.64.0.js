/* Shared kana data for Reading/Writing practice. */
const hiraganaRows = {
    h_a:  {"あ":"a","い":"i","う":"u","え":"e","お":"o"},
    h_ka: {"か":"ka","き":"ki","く":"ku","け":"ke","こ":"ko"},
    h_sa: {"さ":"sa","し":"shi","す":"su","せ":"se","そ":"so"},
    h_ta: {"た":"ta","ち":"chi","つ":"tsu","て":"te","と":"to"},
    h_na: {"な":"na","に":"ni","ぬ":"nu","ね":"ne","の":"no"},
    h_ha: {"は":"ha","ひ":"hi","ふ":"fu","へ":"he","ほ":"ho"},
    h_ma: {"ま":"ma","み":"mi","む":"mu","め":"me","も":"mo"},
    h_ya: {"や":"ya","ゆ":"yu","よ":"yo"},
    h_ra: {"ら":"ra","り":"ri","る":"ru","れ":"re","ろ":"ro"},
    h_wa: {"わ":"wa","を":"wo","ん":"n"}
};

const katakanaRows = {
    k_a:  {"ア":"a","イ":"i","ウ":"u","エ":"e","オ":"o"},
    k_ka: {"カ":"ka","キ":"ki","ク":"ku","ケ":"ke","コ":"ko"},
    k_sa: {"サ":"sa","シ":"shi","ス":"su","セ":"se","ソ":"so"},
    k_ta: {"タ":"ta","チ":"chi","ツ":"tsu","テ":"te","ト":"to"},
    k_na: {"ナ":"na","ニ":"ni","ヌ":"nu","ネ":"ne","ノ":"no"},
    k_ha: {"ハ":"ha","ヒ":"hi","フ":"fu","ヘ":"he","ホ":"ho"},
    k_ma: {"マ":"ma","ミ":"mi","ム":"mu","メ":"me","モ":"mo"},
    k_ya: {"ヤ":"ya","ユ":"yu","ヨ":"yo"},
    k_ra: {"ラ":"ra","リ":"ri","ル":"ru","レ":"re","ロ":"ro"},
    k_wa: {"ワ":"wa","ヲ":"wo","ン":"n"}
};

const dakutenRows = {
    h_ka: {"が":"ga","ぎ":"gi","ぐ":"gu","げ":"ge","ご":"go"},
    h_sa: {"ざ":"za","じ":"ji","ず":"zu","ぜ":"ze","ぞ":"zo"},
    h_ta: {"だ":"da","ぢ":"ji","づ":"zu","で":"de","ど":"do"},
    h_ha: {
        "ば":"ba","び":"bi","ぶ":"bu","べ":"be","ぼ":"bo",
        "ぱ":"pa","ぴ":"pi","ぷ":"pu","ぺ":"pe","ぽ":"po"
    },
    k_ka: {"ガ":"ga","ギ":"gi","グ":"gu","ゲ":"ge","ゴ":"go"},
    k_sa: {"ザ":"za","ジ":"ji","ズ":"zu","ゼ":"ze","ゾ":"zo"},
    k_ta: {"ダ":"da","ヂ":"ji","ヅ":"zu","デ":"de","ド":"do"},
    k_ha: {
        "バ":"ba","ビ":"bi","ブ":"bu","ベ":"be","ボ":"bo",
        "パ":"pa","ピ":"pi","プ":"pu","ペ":"pe","ポ":"po"
    }
};

const yoonRows = {
    h_ka: {"きゃ":"kya","きゅ":"kyu","きょ":"kyo"},
    h_sa: {"しゃ":"sha","しゅ":"shu","しょ":"sho"},
    h_ta: {"ちゃ":"cha","ちゅ":"chu","ちょ":"cho"},
    h_na: {"にゃ":"nya","にゅ":"nyu","にょ":"nyo"},
    h_ha: {
        "ひゃ":"hya","ひゅ":"hyu","ひょ":"hyo",
        "びゃ":"bya","びゅ":"byu","びょ":"byo",
        "ぴゃ":"pya","ぴゅ":"pyu","ぴょ":"pyo"
    },
    h_ma: {"みゃ":"mya","みゅ":"myu","みょ":"myo"},
    h_ra: {"りゃ":"rya","りゅ":"ryu","りょ":"ryo"},
    h_ka_dakuten: {"ぎゃ":"gya","ぎゅ":"gyu","ぎょ":"gyo"},
    h_sa_dakuten: {"じゃ":"ja","じゅ":"ju","じょ":"jo"},
    h_ta_dakuten: {"ぢゃ":"ja","ぢゅ":"ju","ぢょ":"jo"},
    k_ka: {"キャ":"kya","キュ":"kyu","キョ":"kyo"},
    k_sa: {"シャ":"sha","シュ":"shu","ショ":"sho"},
    k_ta: {"チャ":"cha","チュ":"chu","チョ":"cho"},
    k_na: {"ニャ":"nya","ニュ":"nyu","ニョ":"nyo"},
    k_ha: {
        "ヒャ":"hya","ヒュ":"hyu","ヒョ":"hyo",
        "ビャ":"bya","ビュ":"byu","ビョ":"byo",
        "ピャ":"pya","ピュ":"pyu","ピョ":"pyo"
    },
    k_ma: {"ミャ":"mya","ミュ":"myu","ミョ":"myo"},
    k_ra: {"リャ":"rya","リュ":"ryu","リョ":"ryo"},
    k_ka_dakuten: {"ギャ":"gya","ギュ":"gyu","ギョ":"gyo"},
    k_sa_dakuten: {"ジャ":"ja","ジュ":"ju","ジョ":"jo"},
    k_ta_dakuten: {"ヂャ":"ja","ヂュ":"ju","ヂョ":"jo"}
};

const extendedKatakanaRows = {
    k_a: {
        "イェ":"ye",
        "ウィ":"wi","ウェ":"we","ウォ":"wo"
    },
    k_sa: {
        "シェ":"she",
        "ジェ":"je"
    },
    k_ta: {
        "チェ":"che",
        "ティ":"ti","ディ":"di",
        "トゥ":"tu","ドゥ":"du",
        "ツァ":"tsa","ツィ":"tsi","ツェ":"tse","ツォ":"tso"
    },
    k_ha: {
        "ファ":"fa","フィ":"fi","フェ":"fe","フォ":"fo","フュ":"fyu"
    },
    k_wa: {
        "ヴ":"vu","ヴァ":"va","ヴィ":"vi","ヴェ":"ve","ヴォ":"vo","ヴュ":"vyu"
    }
};

const DAILY_CHALLENGE_CHAR_MAP = {
    ...Object.assign({}, ...Object.values(hiraganaRows)),
    ...Object.assign({}, ...Object.values(katakanaRows)),
    ...Object.assign({}, ...Object.values(dakutenRows))
};

const TEST_MODE_BASE_CHAR_MAP = {
    ...Object.assign({}, ...Object.values(hiraganaRows)),
    ...Object.assign({}, ...Object.values(katakanaRows))
};


function flattenKanaRows(rows) {
    return Object.assign({}, ...Object.values(rows));
}

const hiraganaMap = flattenKanaRows(hiraganaRows);
const katakanaMap = flattenKanaRows(katakanaRows);
const dakutenMap = flattenKanaRows(dakutenRows);
const yoonMap = flattenKanaRows(yoonRows);
const extendedKatakanaMap = flattenKanaRows(extendedKatakanaRows);

const kanaCollections = Object.freeze({
    hiragana: Object.freeze(Object.keys(hiraganaMap)),
    katakana: Object.freeze(Object.keys(katakanaMap)),
    dakuten: Object.freeze(Object.keys(dakutenMap)),
    yoon: Object.freeze(Object.keys(yoonMap)),
    extended: Object.freeze(Object.keys(extendedKatakanaMap)),
    all: Object.freeze([...new Set([
        ...Object.keys(hiraganaMap),
        ...Object.keys(katakanaMap),
        ...Object.keys(dakutenMap),
        ...Object.keys(yoonMap),
        ...Object.keys(extendedKatakanaMap)
    ])])
});

window.ModeAtlasKanaData = {
    hiraganaRows,
    katakanaRows,
    dakutenRows,
    yoonRows,
    extendedKatakanaRows,
    DAILY_CHALLENGE_CHAR_MAP,
    TEST_MODE_BASE_CHAR_MAP,
    maps: Object.freeze({
        hiragana: hiraganaMap,
        katakana: katakanaMap,
        dakuten: dakutenMap,
        yoon: yoonMap,
        extended: extendedKatakanaMap
    }),
    collections: kanaCollections
};
