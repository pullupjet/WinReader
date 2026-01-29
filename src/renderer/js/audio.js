// audio.js - 处理 Google 音频和本地 TTS
const settings = require('./settings');

class AudioManager {
    constructor() {
        this.synth = window.speechSynthesis;
        this.googleAudio = null;
    }

    getSystemVoices() {
        return this.synth.getVoices();
    }

    stop() {
        if (this.synth.speaking) this.synth.cancel();
        if (this.googleAudio) {
            this.googleAudio.pause();
            this.googleAudio = null;
        }
    }

    speak(text) {
        this.stop(); // 播放前先打断之前的

        const voiceName = settings.get('voiceName');
        
        // 1. Google 在线发音
        if (voiceName === "Google Online") {
            this.playGoogleTTS(text);
        } else {
            // 2. 本地系统发音
            this.playLocalTTS(text, voiceName);
        }
    }

    playGoogleTTS(text) {
        try {
            // Google TTS API (Unofficial)
            const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=en&client=tw-ob`;
            this.googleAudio = new Audio(url);
            
            // 失败回退到本地
            this.googleAudio.onerror = () => {
                console.warn("Google TTS 失败，降级到本地语音");
                this.playLocalTTS(text, null); // 传入 null 让系统选默认
            };
            this.googleAudio.play();
        } catch (e) {
            this.playLocalTTS(text, null);
        }
    }

    playLocalTTS(text, voiceName) {
        const u = new SpeechSynthesisUtterance(text);
        
        // 如果指定了声音名称，尝试找到它
        if (voiceName) {
            const allVoices = this.getSystemVoices();
            const selectedVoice = allVoices.find(v => v.name === voiceName);
            if (selectedVoice) u.voice = selectedVoice;
        }
        
        u.rate = settings.get('voiceRate') || 1.0;
        this.synth.speak(u);
    }
}

module.exports = new AudioManager();