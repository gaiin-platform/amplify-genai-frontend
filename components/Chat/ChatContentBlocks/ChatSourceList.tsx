import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import ChatSource from "@/components/Chat/ChatContentBlocks/ChatSource";

interface Props {
    name: string;
    sources: any[];
}


const ChatSourceBlock: React.FC<Props> = (
    {sources, name}) => {

    const getDisplayName = (name: string) => {
        if(name === "rag"){
            return "Document Search Results (RAG)";
        }
        else if(name === "documentContext") {
            return "Attached Documents";
        }
        else {
            // split on camel case and capitalize each first letter
            return name.split(/(?=[A-Z])/).map((word) => {
                return word.charAt(0).toUpperCase() + word.slice(1);
            }).join(" ");
        }
    }

    return <div>
        <ExpansionComponent title={getDisplayName(name)}
            content={sources.map((source, index) => (
            <div key={index}>
                <ChatSource source={source}/>
            </div>
        ))}/>
    </div>;
};

export default ChatSourceBlock;
