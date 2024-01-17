

export class OutOfOrderResults {
    constructor() {
        this.sources = {};
    }


    getSourceQueue(src){
        if(!this.sources[src]){
            this.sources[src] = [];
        }

        return this.sources[src];
    }

    addEvent(event) {
        this.getSourceQueue(event.s).push(event);
    }

    getText() {
        const sortedKeys =  Object.keys(this.sources).sort((a,b) => {
            if(a.s < b.s) return -1;
            if(a.s > b.s) return 1;
            return 0;
        });

        let results = "";
        for(const key of sortedKeys){
            const queue = this.sources[key];
            for(const event of queue){
                results += event.d;
            }
            results += "\n";
        }

        return results;
    }
}