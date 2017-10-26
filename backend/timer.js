class timer{
    constructor(total, callback, interval){
        this.totalTime = total;
        this.timeRemain = total;
        this.interval = Math.min((interval || 1000), total);
        this.callback = callback;
    }

    getRemaining(){
        return this.timeRemain;
    }
    
    start(){
        this.stop();
        this.timeRemain = this.totalTime;
        this.intervalFunction = setInterval(this.tick.bind(this), this.interval);
    }

    tick(){
        console.log(this.timeRemain);
        this.timeRemain -= this.interval;
        if (this.timeRemain <= 0){   
            this.stop();
            this.callback();
        }
    }

    stop() {
        clearInterval(this.intervalFunction);
    }
    
}

module.exports = timer;