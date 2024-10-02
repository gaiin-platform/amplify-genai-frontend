
    export interface messageTopicDataPast {
        range: string;
        topic: string;
        description: string;
    }

    export interface messageTopicData {
        pastTopic?: messageTopicDataPast;
        currentTopic?: string;
    }