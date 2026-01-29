// app.js - 前端控制器
const { ipcRenderer } = require('electron');
const fs = require('fs');
const JSZip = require('jszip');
window.JSZip = JSZip; // epubjs 需要全局 JSZip

// 引入模块
const settings = require('./settings');
const audioManager = require('./audio');
const translator = require('./translator');
const BookManager = require('./book');

// --- UI 元素引用 ---
const ui = {
    menuBtn: document.getElementById('menu-btn'),
    closeMenuBtn: document.getElementById('close-menu-btn'),
    drawer: document.getElementById('settings-drawer'),
    voiceSelect: document.getElementById('voice-select'),
    rateInput: document.getElementById('voice-rate'),
    rateVal: document.getElementById('rate-val'),
    fontSize: document.getElementById('font-size'),
    lineHeight: document.getElementById('line-height'),
    fontFamily: document.getElementById('font-family'),
    openBtn: document.getElementById('open-btn'),
    testVoiceBtn: document.getElementById('test-voice-btn'),
    cards: {
        wordHead: document.getElementById('word-head'),
        wordMeaning: document.getElementById('word-meaning'),
        sentenceEn: document.getElementById('sentence-en'),
        sentenceCn: document.getElementById('sentence-cn')
    }
};

// --- 初始化 Book Manager ---
// 这是核心回调：当书里的单词被点击时发生什么
const bookManager = new BookManager("viewer", (word, sentence) => {
    handleWordClick(word, sentence);
});

// --- 事件处理逻辑 ---

// 1. 单词点击处理
async function handleWordClick(rawWord, sentence) {
    const word = rawWord.toLowerCase();
    
    // 播放声音
    audioManager.speak(rawWord);

    // 更新单词卡片
    ui.cards.wordHead.innerText = rawWord;
    const localDef = translator.lookupLocal(word);
    
    if (localDef) {
        ui.cards.wordMeaning.innerText = "⚡ [本地] " + localDef;
    } else {
        ui.cards.wordMeaning.innerText = "查询中...";
        try {
            const result = await translator.translateNetwork(word);
            ui.cards.wordMeaning.innerText = result;
        } catch(e) {
            ui.cards.wordMeaning.innerText = "翻译失败";
        }
    }

    // 更新句子卡片
    ui.cards.sentenceEn.innerText = sentence.trim();
    ui.cards.sentenceCn.innerText = "Translating...";
    try {
        const result = await translator.translateNetwork(sentence);
        ui.cards.sentenceCn.innerText = result;
    } catch(e) {
        ui.cards.sentenceCn.innerText = "翻译失败";
    }
}

// 2. 初始化 UI 状态
function initUI() {
    const s = settings.getAll();
    ui.fontSize.value = s.fontSize;
    ui.lineHeight.value = s.lineHeight;
    ui.fontFamily.value = s.fontFamily;
    ui.rateInput.value = s.voiceRate;
    ui.rateVal.innerText = s.voiceRate;
    
    // 加载书籍
    const lastBookPath = localStorage.getItem('lastOpenBookPath');
    if (lastBookPath && fs.existsSync(lastBookPath)) {
        bookManager.load(lastBookPath);
    }
}

// 3. 语音列表加载逻辑
function loadVoiceList() {
    const voices = audioManager.getSystemVoices();
    ui.voiceSelect.innerHTML = "";

    // 添加 Google 选项
    const googleOption = document.createElement('option');
    googleOption.textContent = "🌐 Google Online (联网标准音)";
    googleOption.value = "Google Online";
    googleOption.style.fontWeight = "bold";
    googleOption.style.color = "#4ec9b0";
    ui.voiceSelect.appendChild(googleOption);

    // 添加本地选项
    const enVoices = voices.filter(v => v.lang.includes('en') || v.lang.includes('US') || v.lang.includes('UK'));
    (enVoices.length ? enVoices : voices).forEach(voice => {
        const option = document.createElement('option');
        option.textContent = `💻 [本地] ${voice.name}`;
        option.value = voice.name;
        ui.voiceSelect.appendChild(option);
    });

    // 恢复选中状态
    const savedName = settings.get('voiceName');
    if (savedName) {
        if (savedName === "Google Online") {
            ui.voiceSelect.value = "Google Online";
        } else {
            const exists = Array.from(ui.voiceSelect.options).some(o => o.value === savedName);
            if (exists) ui.voiceSelect.value = savedName;
        }
    }
}

// --- 事件绑定 ---

// 语音加载事件
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoiceList;
}
setTimeout(loadVoiceList, 500); // 兜底

// 菜单开关
ui.menuBtn.onclick = () => ui.drawer.classList.add('active');
ui.closeMenuBtn.onclick = () => ui.drawer.classList.remove('active');

// 打开书籍 IPC
ui.openBtn.onclick = () => ipcRenderer.send('open-file-dialog');
ipcRenderer.on('selected-file', (event, path) => {
    ui.drawer.classList.remove('active');
    localStorage.setItem('lastOpenBookPath', path);
    bookManager.load(path);
});

// 设置变更
ui.voiceSelect.onchange = (e) => {
    settings.set('voiceName', e.target.value);
    audioManager.speak("Voice changed");
};

ui.rateInput.oninput = (e) => {
    const val = e.target.value;
    ui.rateVal.innerText = val;
    settings.set('voiceRate', val);
};

ui.testVoiceBtn.onclick = () => {
    audioManager.speak("This is a test of the audio quality.");
};

// 样式变更
const updateStyle = () => {
    settings.set('fontSize', ui.fontSize.value);
    settings.set('lineHeight', ui.lineHeight.value);
    settings.set('fontFamily', ui.fontFamily.value);
    bookManager.applyTheme();
};

ui.fontSize.oninput = updateStyle;
ui.lineHeight.oninput = updateStyle;
ui.fontFamily.onchange = updateStyle;

// 启动
initUI();