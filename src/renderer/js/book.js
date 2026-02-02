// book.js - 键盘与右键翻页版
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

    async load(filePath) {
        this.currentBookKey = "epub-pos-" + filePath;
        const data = fs.readFileSync(filePath); 
        const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);

        if (this.book) this.book.destroy();
        this.book = ePub(arrayBuffer);
        
        const container = document.getElementById(this.viewerId);
        container.innerHTML = ''; 
        
        // 翻页模式配置
        this.rendition = this.book.renderTo(this.viewerId, {
            width: "100%",
            height: "100%",
            allowScriptedContent: true
        });

        this.attachEvents();
        
        const targetCfi = localStorage.getItem(this.currentBookKey);
        await this.rendition.display(targetCfi || undefined);

        await this.book.ready;
        return await this.book.loaded.navigation;
    }

    jumpTo(href) {
        if (this.rendition) {
            this.rendition.display(href);
        }
    }

    attachEvents() {
        // --- 1. 键盘事件处理 (→ ↓ 下一页, ← ↑ 上一页) ---
        const handleKey = (e) => {
            // 忽略在输入框内的按键
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            switch (e.key) {
                case "ArrowRight":
                case "ArrowDown":
                    this.rendition.next();
                    break;
                case "ArrowLeft":
                case "ArrowUp":
                    this.rendition.prev();
                    break;
            }
        };

        // 监听主文档的按键（当焦点在外部时）
        document.addEventListener('keyup', handleKey);
        
        // 监听 epub 内部的按键（当焦点在书本内容时）
        this.rendition.on('keyup', handleKey);


        // --- 2. 鼠标右键处理 (下一页) ---
        // 放在 content hook 里，确保能捕获 iframe 内部的点击
        this.rendition.hooks.content.register(contents => {
            const doc = contents.document;
            const body = doc.body;

            // 样式与分词 (保持之前的稳定逻辑)
            this.applyTheme(); 
            this.wrapWords(body, contents);

            // 监听 iframe 内部的右键点击
            doc.addEventListener('contextmenu', (e) => {
                e.preventDefault(); // 阻止浏览器默认的右键菜单
                this.rendition.next(); // 触发下一页
            });
        });

        // 监听主容器的右键点击（防止点击边缘空白处无反应）
        const container = document.getElementById(this.viewerId);
        container.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.rendition.next();
        });


        // --- 3. 渲染样式与进度保存 ---
        this.rendition.hooks.render.register(() => this.applyTheme());

        this.rendition.on('relocated', (location) => {
            localStorage.setItem(this.currentBookKey, location.start.cfi);
        });
    }

    applyTheme() {
        if (!this.rendition) return;
        const s = settings.getAll();
        
        this.rendition.themes.default({
            "p": { 
                "font-size": `${s.fontSize}px !important`,
                "line-height": `${s.lineHeight} !important`,
                "font-family": `${s.fontFamily} !important`,
                "color": "#333 !important",
                "text-align": "justify !important"
            },
            // 保持 inline 和 0 padding，这是防止排版错乱的关键
            "span.click-word": { 
                "cursor": "pointer", 
                "display": "inline", 
                "padding": "0", 
                "margin": "0",
                "background-color": "transparent",
                "position": "relative",
                "z-index": "1"
            },
            "span.click-word:hover": { 
                "background-color": "rgba(33, 150, 243, 0.2)",
                "outline": "2px solid rgba(33, 150, 243, 0.1)"
            },
            "span.click-word.active": { 
                "background-color": "#007acc", 
                "color": "white",
                "box-shadow": "0 0 0 1px #007acc"
            }
        });
    }

    wrapWords(element, contents) {
        const nodes = Array.from(element.childNodes);
        nodes.forEach(node => {
            if (node.nodeType === 3) {
                const text = node.nodeValue;
                if (!text.trim()) return;
                
                const tokens = text.split(/([a-zA-Z\u00C0-\u00FF]+)/g);
                const fragment = document.createDocumentFragment();
                
                tokens.forEach(token => {
                    if (token === "") return;
                    if (/^[a-zA-Z\u00C0-\u00FF]+$/.test(token)) {
                        const span = document.createElement('span');
                        span.className = 'click-word';
                        span.innerText = token;
                        // 左键点击单词逻辑 (保持不变)
                        span.onclick = (e) => {
                            e.stopPropagation();
                            contents.document.querySelectorAll('.click-word.active')
                                .forEach(el => el.classList.remove('active'));
                            span.classList.add('active');
                            const sentence = this.extractSentence(span, token);
                            if (this.onWordClick) this.onWordClick(token, sentence);
                        };
                        fragment.appendChild(span);
                    } else {
                        fragment.appendChild(document.createTextNode(token));
                    }
                });
                node.parentNode.replaceChild(fragment, node);
            } else if (node.nodeType === 1) { 
                if (!node.classList.contains('click-word') && 
                    node.tagName !== 'SCRIPT' && 
                    node.tagName !== 'STYLE') {
                    this.wrapWords(node, contents); 
                }
            }
        });
    }

    extractSentence(spanElement, rawWord) {
        let parentBlock = spanElement.parentElement;
        while (parentBlock && window.getComputedStyle(parentBlock).display === 'inline') {
            parentBlock = parentBlock.parentElement;
        }
        if (parentBlock) {
            const fullText = parentBlock.innerText;
            const sentences = fullText.match(/[^.!?,;:\n\r]+[.!?,\n\r;:]+|$/g) || [fullText];
            return sentences.find(s => s.includes(rawWord)) || fullText;
        }
        return rawWord;
    }
}

module.exports = BookManager;