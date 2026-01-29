// book.js - EPUB 渲染核心
const ePubLib = require('epubjs');
const ePub = ePubLib.default || ePubLib;
const fs = require('fs');
const settings = require('./settings');

class BookManager {
    constructor(viewerId, onWordClickCallback) {
        this.viewerId = viewerId;
        this.book = null;
        this.rendition = null;
        this.currentBookKey = "";
        this.onWordClick = onWordClickCallback;
    }

    load(filePath) {
        this.currentBookKey = "epub-pos-" + filePath;
        
        // 读取文件 buffer
        const data = fs.readFileSync(filePath); 
        const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);

        // 销毁旧实例
        if (this.book) this.book.destroy();
        
        // 创建新书
        this.book = ePub(arrayBuffer);
        
        // 清空容器
        document.getElementById(this.viewerId).innerHTML = ''; 
        
        this.rendition = this.book.renderTo(this.viewerId, {
            width: "100%",
            height: "100%",
            flow: "scrolled-doc",
            manager: "continuous"
        });

        this.attachEvents();
        this.restorePosition();
    }

    attachEvents() {
        // 渲染开始时应用样式
        this.rendition.hooks.render.register(() => this.applyTheme());

        // 渲染内容时处理单词包裹
        this.rendition.hooks.content.register(contents => {
            this.applyTheme(); 
            this.wrapWords(contents.document.body, contents);
        });

        // 记录进度
        this.rendition.on('relocated', (location) => {
            localStorage.setItem(this.currentBookKey, location.start.cfi);
        });
    }

    restorePosition() {
        const savedCfi = localStorage.getItem(this.currentBookKey);
        this.rendition.display(savedCfi || undefined);
    }

    applyTheme() {
        if (!this.rendition) return;
        const s = settings.getAll();
        
        this.rendition.themes.default({
            "p": { 
                "font-size": `${s.fontSize}px !important`,
                "line-height": `${s.lineHeight} !important`,
                "font-family": `${s.fontFamily} !important`,
                "color": "#333 !important", "text-align": "justify" 
            },
            "div": {
                "font-size": `${s.fontSize}px !important`,
                "line-height": `${s.lineHeight} !important`,
                "font-family": `${s.fontFamily} !important`
            },
            "span.click-word": { "cursor": "pointer", "border-radius": "3px" },
            "span.click-word:hover": { "background-color": "rgba(33, 150, 243, 0.2)" },
            "span.click-word.active": { "background-color": "#007acc", "color": "white" }
        });
    }

    // 递归包裹单词
    wrapWords(element, contents) {
        const nodes = Array.from(element.childNodes);
        nodes.forEach(node => {
            if (node.nodeType === 3) { // 文本节点
                // --- 修复点在这里：之前写成了 constHbtext ---
                const text = node.nodeValue;
                if (!text.trim()) return;
                
                // 按单词分割（保留分隔符）
                const tokens = text.split(/([a-zA-Z\u00C0-\u00FF]+)/g);
                const fragment = document.createDocumentFragment();
                
                tokens.forEach(token => {
                    if (/^[a-zA-Z\u00C0-\u00FF]+$/.test(token)) {
                        const span = document.createElement('span');
                        span.className = 'click-word';
                        span.innerText = token;
                        span.onclick = (e) => {
                            e.stopPropagation();
                            // 清除其他高亮
                            contents.document.querySelectorAll('.click-word.active')
                                .forEach(el => el.classList.remove('active'));
                            span.classList.add('active');
                            
                            // 获取上下文句子
                            const sentence = this.extractSentence(span, token);
                            
                            // 触发外部回调
                            if (this.onWordClick) this.onWordClick(token, sentence);
                        };
                        fragment.appendChild(span);
                    } else {
                        fragment.appendChild(document.createTextNode(token));
                    }
                });
                node.parentNode.replaceChild(fragment, node);
            } else if (node.nodeType === 1) { 
                this.wrapWords(node, contents); 
            }
        });
    }

    // 提取当前单词所在的整句
    extractSentence(spanElement, rawWord) {
        let parentBlock = spanElement.parentElement;
        // 向上查找直到找到块级元素
        while (parentBlock && window.getComputedStyle(parentBlock).display === 'inline') {
            parentBlock = parentBlock.parentElement;
        }
        if (parentBlock) {
            const fullText = parentBlock.innerText;
            // 简单的正则分句
            const sentences = fullText.match(/[^.!?,;:\n\r]+[.!?,\n\r;:]+|$/g) || [fullText];
            return sentences.find(s => s.includes(rawWord)) || fullText;
        }
        return rawWord;
    }
}

module.exports = BookManager;