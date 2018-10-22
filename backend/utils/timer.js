/** Timer Class */

/**
 * Anonymous function that gets called when timer run out
 * @callback timerCallback
 */

class timer{
    /**
     * Create a timer.
     * @param {number} total - Total amount of time to count down.
     * @param {timerCallback} callback - The function that gets called when timer run out.
     * @param {number} interval - How often the timer update itself.
     * @param {function} tickFunction - The function that gets executed each tick
     */
    constructor(total, callback, interval, tickFunction){
        this.totalTime = total;
        this.timeRemain = total;
        this.interval = Math.min((interval || 1000), total);
        this.callback = callback;
        this.tickFunction = tickFunction;
    }

    /**
     * Get time remaining.
     * @return {number} The remaining time.
     */
    getRemaining(){
        return this.timeRemain;
    }

    /**
     * Start the timer
     */
    start(){
        this.reset();
        this.intervalFunction = setInterval(this.tick.bind(this), this.interval);
    }

    /**
     * Tick the timer, if timer is finished, call the callback function
     */
    tick(){
        this.timeRemain -= this.interval;
        this.tickFunction();
        if (this.timeRemain <= 0){   
            this.stop();
            this.callback();
        }
    }

    /**
     * Stop the timer, doesn't trigger callback
     */
    stop() {
        clearInterval(this.intervalFunction);
    }

    reset(){
        this.stop();
        this.timeRemain = this.totalTime;
    }
    
}

module.exports = timer;