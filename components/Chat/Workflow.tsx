import {Message} from "@/types/chat";

export default class Workflow {

    constructor(public name: string, public messages: Message[]) {}

}