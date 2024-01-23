

export class OutOfOrderResults {

    private sources: { [p: string]: any[] };

    constructor() {
        this.sources = {};
    }

    getSourceQueue(src:string){
        if(!this.sources[src]){
            this.sources[src] = [];
        }

        return this.sources[src];
    }

    addEvent(event:any) {
        this.getSourceQueue(event.s).push(event);
    }

    getText() {
        const sortedKeys =  Object.keys(this.sources).sort((a,b) => {
            if(a < b) return -1;
            if(a > b) return 1;
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