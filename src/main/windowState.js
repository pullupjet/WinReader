// src/main/windowState.js
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

class WindowStateManager {
    constructor() {
        // 配置文件路径
        this.path = path.join(app.getPath('userData'), 'window-state.json');
        
        // 默认状态
        this.data = {
            width: 1200,
            height: 800,
            x: undefined,
            y: undefined
        };

        this.load();
    }

    // 加载状态
    load() {
        try {
            if (fs.existsSync(this.path)) {
                const fileData = fs.readFileSync(this.path, 'utf8');
                const savedState = JSON.parse(fileData);
                // 合并保存的状态
                this.data = { ...this.data, ...savedState };
            }
        } catch (err) {
            console.error('加载窗口状态失败:', err);
        }
    }

    // 保存状态
    save(bounds) {
        this.data = { ...this.data, ...bounds };
        try {
            fs.writeFileSync(this.path, JSON.stringify(this.data));
        } catch (err) {
            console.error('保存窗口状态失败:', err);
        }
    }

    // 获取当前应该使用的窗口配置
    getState() {
        return this.data;
    }

    // 绑定窗口事件，自动管理保存
    manage(window) {
        // 当窗口关闭时自动保存
        window.on('close', () => {
            this.save(window.getBounds());
        });
    }
}

module.exports = WindowStateManager;