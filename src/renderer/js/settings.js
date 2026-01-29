// settings.js - 单例模式管理配置
class SettingsManager {
    constructor() {
        this.defaults = {
            fontSize: 18,
            lineHeight: 1.6,
            fontFamily: "Microsoft YaHei",
            voiceName: "Google Online",
            voiceRate: 1.0
        };
        this.current = { ...this.defaults };
        this.load();
    }

    load() {
        const saved = localStorage.getItem('reader-settings');
        if (saved) {
            this.current = JSON.parse(saved);
        }
    }

    save() {
        localStorage.setItem('reader-settings', JSON.stringify(this.current));
    }

    get(key) {
        return this.current[key];
    }

    set(key, value) {
        this.current[key] = value;
        this.save();
    }
    
    getAll() {
        return this.current;
    }
}

module.exports = new SettingsManager();