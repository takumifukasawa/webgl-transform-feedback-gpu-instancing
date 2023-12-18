export class FPSCounter {
    renderCount = 0;
    startCountTime = -Infinity;
    calculateInterval = 1;
    currentFPS = 0;

    constructor(calculateInterval = 1) {
        this.calculateInterval = calculateInterval;
    }

    /**
     *
     * @param time[sec]
     * @private
     */
    start(time) {
        this.renderCount = 0;
        this.startCountTime = time;
    }

    /**
     *
     * @param time[sec]
     */
    calculate(time) {
        // first exec
        if (this.startCountTime < 0) {
            this.start(time);
            return;
        }

        this.renderCount++;

        const elapsedTime = time - this.startCountTime;
        if (elapsedTime > this.calculateInterval) {
            this.currentFPS = this.renderCount / elapsedTime;
            this.start(time);
        }
    }
}
