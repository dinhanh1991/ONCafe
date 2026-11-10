// Phát âm báo ngắn khi có thông báo đơn hàng; nhân viên có thể bật hoặc tắt.
export class NotificationSound {
    // Khởi tạo đối tượng và đọc cài đặt âm báo đã lưu.
    constructor({ stateRepository }) {
        this.stateRepository = stateRepository;
        this.enabled = stateRepository.isSoundEnabled();
        this.audioContext = null;
    }

    // Bật hoặc tắt âm báo và lưu lại cài đặt.
    setEnabled(enabled) {
        this.enabled = Boolean(enabled);
        this.stateRepository.setSoundEnabled(this.enabled);
    }

    // Phát âm báo; trình duyệt có thể chặn khi chưa có tương tác nên bỏ qua lỗi.
    play(kind) {
        if (!this.enabled) return;
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            this.audioContext = this.audioContext || new AudioContextClass();
            if (this.audioContext.state === "suspended") void this.audioContext.resume();

            // new: hai nốt (đơn mới); completed: một nốt cao (đơn hoàn tất); info: một nốt thấp (đồ uống, nhân viên mới).
            const notes = kind === "completed" ? [660] : kind === "info" ? [523] : [880, 1175];
            const start = this.audioContext.currentTime;
            notes.forEach((frequency, index) => {
                const oscillator = this.audioContext.createOscillator();
                const gain = this.audioContext.createGain();
                const at = start + index * 0.16;
                oscillator.type = "sine";
                oscillator.frequency.value = frequency;
                gain.gain.setValueAtTime(0.0001, at);
                gain.gain.exponentialRampToValueAtTime(0.18, at + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
                oscillator.connect(gain).connect(this.audioContext.destination);
                oscillator.start(at);
                oscillator.stop(at + 0.24);
            });
        } catch {
            // Không phát được âm thanh thì vẫn còn thông báo hình ảnh.
        }
    }
}
