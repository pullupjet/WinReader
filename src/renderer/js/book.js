// book.js - EPUB 渲染核心 (终极稳定渲染版)
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
        
        this.targetCfi = null;       // 记录预期跳转的目标
        this.isLocking = false;      // 锁定标记，防止分词期间坐标污染
    }

    async load(filePath) {
        this.currentBookKey = "epub-pos-" + filePath;
        const data = fs.readFileSync(filePath); 
        const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);

        if (this.book) this.book.destroy();
        this.book = ePub(arrayBuffer);
        
        const container = document.getElementById(this.viewerId);
        container.innerHTML = ''; 
        container.style.opacity = "0"; // 初始隐藏

        this.rendition = this.book.renderTo(this.viewerId, {
            width: "100%",
            height: "100%",
            flow: "scrolled-doc",
            manager: "continuous"
        });

        this.attachEvents();
        
        this.targetCfi = localStorage.getItem(this.currentBookKey);
        await this.rendition.display(this.targetCfi || undefined);

        await this.book.ready;
        return await this.book.loaded.navigation;
    }

    jumpTo(href) {
        if (this.rendition) {
            this.isLocking = true;
            this.targetCfi = href;
            
            const container = document.getElementById(this.viewerId);
            container.style.transition = "none";
            container.style.opacity = "0";
            
            this.rendition.display(href);
        }
    }

    attachEvents() {
        this.rendition.hooks.render.register(() => this.applyTheme());

        this.rendition.hooks.content.register(contents => {
            this.isLocking = true;
            const doc = contents.document;
            
            this.applyTheme(); 
            
            // 获取当前位置用于校准
            const cfiToRestore = this.targetCfi || this.rendition.currentLocation().start.cfi;

            // 分词处理
            this.wrapWords(doc.body, contents);

            // 核心定位校准：等待 DOM 稳定后强制再次 display
            setTimeout(async () => {
                if (cfiToRestore) {
                    await this.rendition.display(cfiToRestore);
                }

                // 校准完成后显示
                requestAnimationFrame(() => {
                    const container = document.getElementById(this.viewerId);
                    container.style.transition = "opacity 0.2s ease-in";
                    container.style.opacity = "1";
                    
                    setTimeout(() => {
                        this.isLocking = false;
                        this.targetCfi = null;
                    }, 150);
                });
            }, 100); 
        });

        this.rendition.on('relocated', (location) => {
            if (!this.isLocking) {
                localStorage.setItem(this.currentBookKey, location.start.cfi);
            }
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
                "text-align": "justify !important",
                "word-spacing": "normal !important",
                "letter-spacing": "normal !important"
            },
            "div": {
                "font-size": `${s.fontSize}px !important`,
                "line-height": `${s.lineHeight} !important`
            },
            "span.click-word": { 
                "cursor": "pointer", 
                "border-radius": "3px",
                "display": "inline !important", // 必须设为 inline 才能保持两端对齐正常
                "padding": "0 1px"
            },
            "span.click-word:hover": { "background-color": "rgba(33, 150, 243, 0.2)" },
            "span.click-word.active": { "background-color": "#007acc", "color": "white" }
        });
    }

    wrapWords(element, contents) {
        const nodes = Array.from(element.childNodes);
        nodes.forEach(node => {
            if (node.nodeType === 3) {
                const text = node.nodeValue;
                if (!text.trim()) return;
                
                // 改进正则：保留空格和标点
                const tokens = text.split(/([a-zA-Z\u00C0-\u00FF]+)/g);
                const fragment = document.createDocumentFragment();
                
                tokens.forEach(token => {
                    if (/^[a-zA-Z\u00C0-\u00FF]+$/.test(token)) {
                        const span = document.createElement('span');
                        span.className = 'click-word';
                        span.innerText = token;
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
                        // 非单词部分（空格、标点）保持原样
                        fragment.appendChild(document.createTextNode(token));
                    }
                });
                node.parentNode.replaceChild(fragment, node);
            } else if (node.nodeType === 1) { 
                // 排除已经被处理过的 span，防止死循环
                if (!node.classList.contains('click-word')) {
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