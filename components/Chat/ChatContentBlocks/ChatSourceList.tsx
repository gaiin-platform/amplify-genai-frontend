import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import ChatSource from "@/components/Chat/ChatContentBlocks/ChatSource";
import { capitalize } from "@/utils/app/data";

interface Props {
    name: string;
    sources: any[];
}


const ChatSourceBlock: React.FC<Props> = (
    {sources, name}) => {


    const getDisplayName = (name: string) => {
        if (name === "rag") {
            return "Document Search Results (RAG)";
        } else if(name === "documentContext") {
            return "Attached Documents";
        } else if(name === "documentCacheContext") {
            return "Document Search Results (Advanced RAG)";
        } else if (name === "images") {
            return "Images"
        } else {
            // split on camel case and capitalize each first letter
            return name.split(/(?=[A-Z])/).map((word) => {
                return capitalize(word);
            }).join(" ");
        }
    }

    return <div>
        <ExpansionComponent 
            title={getDisplayName(name)}
            content={ sources && sources.length > 0 ?
            sources.map((source, index) => (
            <div key={index}>
                <ChatSource source={source} index={index + 1} name={name}/>
            </div> )) :
            <div className="text-gray-400 text-sm ml-1">No Sources to Display</div>
        }/>
    </div>;
};

export default ChatSourceBlock;
