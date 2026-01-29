// translator.js - 词典和谷歌翻译
const localDict = require('../data/dictionary');

class Translator {
    
    // 查本地词典
    lookupLocal(word) {
        return localDict[word.toLowerCase()] || null;
    }

    // 网络翻译（支持单词和句子）
    async translateNetwork(text) {
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`;
            const res = await fetch(url);
            const data = await res.json();
            
            let result = "";
            if (data && data[0]) {
                data[0].forEach(seg => { 
                    if(seg[0]) result += seg[0]; 
                });
            }
            return result;
        } catch (e) {
            console.error(e);
            throw new Error("翻译失败");
        }
    }
}

module.exports = new Translator();