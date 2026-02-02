// app.js - 前端控制器 (增强版：加入章节功能)
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
    // 新增：章节选择下拉框
    tocSelect: document.getElementById('toc-select'),
    cards: {
        wordHead: document.getElementById('word-head'),
        wordMeaning: document.getElementById('word-meaning'),
        sentenceEn: document.getElementById('sentence-en'),
        sentenceCn: document.getElementById('sentence-cn')
    }
};

// --- 初始化 Book Manager ---
const bookManager = new BookManager("viewer", (word, sentence) => {
    handleWordClick(word, sentence);
});

// --- 事件处理逻辑 ---

// 1. 单词点击处理
async function handleWordClick(rawWord, sentence) {
    const word = rawWord.toLowerCase();
    audioManager.speak(rawWord);
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

    ui.cards.sentenceEn.innerText = sentence.trim();
    ui.cards.sentenceCn.innerText = "Translating...";
    try {
        const result = await translator.translateNetwork(sentence);
        ui.cards.sentenceCn.innerText = result;
    } catch(e) {
        ui.cards.sentenceCn.innerText = "翻译失败";
    }
}

// 新增：渲染目录逻辑
function renderTOC(nav) {
    if (!ui.tocSelect) return;
    ui.tocSelect.innerHTML = ""; // 清空
    
    // 添加默认提示项
    const defaultOpt = document.createElement('option');
    defaultOpt.innerText = "--- 选择章节 ---";
    ui.tocSelect.appendChild(defaultOpt);

    // 递归处理目录（防止有些书有子目录）
    const addItems = (items, level = 0) => {
        items.forEach(chapter => {
            const option = document.createElement('option');
            option.value = chapter.href;
            // 根据层级加缩进，让目录更好看
            option.innerText = "　".repeat(level) + chapter.label.trim();
            ui.tocSelect.appendChild(option);
            
            if (chapter.subitems && chapter.subitems.length > 0) {
                addItems(chapter.subitems, level + 1);
            }
        });
    };
    
    addItems(nav.toc);
}

// 2. 初始化 UI 状态
async function initUI() {
    const s = settings.getAll();
    ui.fontSize.value = s.fontSize;
    ui.lineHeight.value = s.lineHeight;
    ui.fontFamily.value = s.fontFamily;
    ui.rateInput.value = s.voiceRate;
    ui.rateVal.innerText = s.voiceRate;
    
    // 自动加载上次的书籍
    const lastBookPath = localStorage.getItem('lastOpenBookPath');
    if (lastBookPath && fs.existsSync(lastBookPath)) {
        try {
            const nav = await bookManager.load(lastBookPath);
            renderTOC(nav);
        } catch (e) {
            console.error("加载旧书籍失败:", e);
        }
    }
}

// 3. 语音列表加载逻辑
function loadVoiceList() {
    const voices = audioManager.getSystemVoices();
    ui.voiceSelect.innerHTML = "";
    const googleOption = document.createElement('option');
    googleOption.textContent = "🌐 Google Online";
    googleOption.value = "Google Online";
    ui.voiceSelect.appendChild(googleOption);

    const enVoices = voices.filter(v => v.lang.includes('en') || v.lang.includes('US') || v.lang.includes('UK'));
    (enVoices.length ? enVoices : voices).forEach(voice => {
        const option = document.createElement('option');
        option.textContent = `💻 [本地] ${voice.name}`;
        option.value = voice.name;
        ui.voiceSelect.appendChild(option);
    });

    const savedName = settings.get('voiceName');
    if (savedName) ui.voiceSelect.value = savedName;
}

// --- 事件绑定 ---

if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoiceList;
}
setTimeout(loadVoiceList, 500);

ui.menuBtn.onclick = () => ui.drawer.classList.add('active');
ui.closeMenuBtn.onclick = () => ui.drawer.classList.remove('active');

// 章节跳转绑定
ui.tocSelect.onchange = (e) => {
    if (e.target.value) {
        bookManager.jumpTo(e.target.value);
        // 跳转后自动关闭菜单（可选，提升体验）
        // ui.drawer.classList.remove('active');
    }
};

// 打开书籍
ui.openBtn.onclick = () => ipcRenderer.send('open-file-dialog');
ipcRenderer.on('selected-file', async (event, path) => {
    ui.drawer.classList.remove('active');
    localStorage.setItem('lastOpenBookPath', path);
    // 加载并渲染目录
    const nav = await bookManager.load(path);
    renderTOC(nav);
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

ui.testVoiceBtn.onclick = () => audioManager.speak("Testing audio quality.");

const updateStyle = () => {
    settings.set('fontSize', ui.fontSize.value);
    settings.set('lineHeight', ui.lineHeight.value);
    settings.set('fontFamily', ui.fontFamily.value);
    bookManager.applyTheme();
};

ui.fontSize.oninput = updateStyle;
ui.lineHeight.oninput = updateStyle;
ui.fontFamily.onchange = updateStyle;

initUI();