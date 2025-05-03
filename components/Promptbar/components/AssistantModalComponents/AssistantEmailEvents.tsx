import { IconAlertTriangle, IconBulb, IconCheck, IconLoader2, IconMailBolt, IconPencilBolt } from "@tabler/icons-react";
import Checkbox from "../../../ReusableComponents/CheckBox";
import { InfoBox } from "../../../ReusableComponents/InfoBox";
import ExpansionComponent from "../../../Chat/ExpansionComponent";
import { constructAstEventEmailAddress, EMAIL_EVENT_TAG_PREFIX, isPresetEmailEventTag, safeEmailEventTag } from "@/utils/app/assistantEmailEvents";
import { useSession } from "next-auth/react";
import { useContext, useEffect, useRef } from "react";
import HomeContext from "@/pages/api/home/home.context";
import { isEventTemplateTagAvailable } from "@/services/emailEventService";

// Fallback function in case the imported one is not available
const isPresetEmailEventTagFallback = (initialTag: string | undefined): boolean => {
  if (!initialTag) return false;
  return !initialTag.startsWith(EMAIL_EVENT_TAG_PREFIX);
};

interface ApiItemProps {
    assistantId: string | undefined;
    initialEmailEventTag: string | undefined;
    enableEmailEvents: boolean;
    setEnableEmailEvents: (enableEmailEvents: boolean) => void;
    emailEventTag: string | undefined;
    setEmailEventTag: (emailEventTag: string | undefined) => void;
    emailEventTemplate: {systemPrompt?: string, userPrompt?: string} | undefined;
    setEmailEventTemplate: (emailEventTemplate: {systemPrompt?: string, userPrompt?: string} | undefined) => void;
    isTagAvailable: boolean;
    setIsTagAvailable: (isTagAvailable: boolean) => void;
    isCheckingTag: boolean;
    setIsCheckingTag: (isCheckingTag: boolean) => void;

    assistantName: string;
    disableEdit: boolean;

  }

  
  export const AssistantEmailEvents: React.FC<ApiItemProps> = ({initialEmailEventTag, enableEmailEvents, setEnableEmailEvents, disableEdit, assistantName, assistantId,
                                                         emailEventTag, setEmailEventTag, emailEventTemplate, setEmailEventTemplate, isTagAvailable, setIsTagAvailable,
                                                         isCheckingTag, setIsCheckingTag}) => {

    const { state: { aiEmailDomain, featureFlags }} = useContext(HomeContext);
    const { data: session } = useSession();
    const userEmail = session?.user?.email ?? '';

    // Use fallback function if the imported one fails
    const isPresetCheck = typeof isPresetEmailEventTag === 'function' ? isPresetEmailEventTag : isPresetEmailEventTagFallback;

    const validatedTagCacheRef = useRef<{valid: string[], invalid: string[]}>({valid: [], invalid: []});


    const handleCheckIsTagAvailable = async (tag: string) => {
        if (validatedTagCacheRef.current.valid.includes(tag) || 
           validatedTagCacheRef.current.invalid.includes(tag)) {
            setIsTagAvailable(validatedTagCacheRef.current.valid.includes(tag));
            setIsCheckingTag(false);
            return;
        }

        const result = await isEventTemplateTagAvailable(tag, assistantId);
        let isAvailable = false;
        if (result && result.success) {
            isAvailable = result.data?.available;
            validatedTagCacheRef.current[isAvailable ? "valid" : "invalid"].push(tag);
            if (!featureFlags.assistantEmailEvents) {
                handleNotAvailableEditNotAllowed(tag);
                return;
            }
        } 

        setIsTagAvailable(isAvailable);
        setIsCheckingTag(false);
    }
    // edge case where is tag is not available and feature flag prevents them from editing the tag
    const handleNotAvailableEditNotAllowed = (tag: string) => {
        const randomTag = `${tag}_${Math.floor(1000 + Math.random() * 9000)}`;
        setEmailEventTag(randomTag);
        setIsTagAvailable(true);
        setIsCheckingTag(false);
    }


    useEffect(() => {
        if (isCheckingTag) handleCheckIsTagAvailable(emailEventTag ?? safeEmailEventTag(assistantName));
    }, [isCheckingTag]);

    return (
        <>
            <div className="mt-4 mb-2 ml-1 flex flex-row gap-3">
            <Checkbox
                id={`emailEvents`}
                bold={true}
                label="Enable Email Events"
                checked={enableEmailEvents}
                onChange={(checked) => setEnableEmailEvents(checked)}
                disabled={disableEdit}
            />
            <IconMailBolt className="mt-1" size={18} />
            </div>
            <div className="mx-6 mt-[-4px] flex flex-col gap-4">
            <InfoBox 
                content={
                    <span className="px-4"> 
                        This feature allows you to email your assistant directly. When enabled, you can customize the assistant&apos;s behavior 
                        by configuring the system prompt and instructions given to the assistant when it receives an email.
                        <div className="text-center mt-1 font-bold"> Email the Assistant at: 
                            <div className='text-blue-500'>{`${constructAstEventEmailAddress(emailEventTag ?? safeEmailEventTag(assistantName), userEmail, aiEmailDomain)}`}</div>  
                        </div>    
                    </span>}
            /> 
            <div className={`relative w-full ${enableEmailEvents ? "" : "opacity-40"}`}>
                <div className="absolute right-0 flex flex-row gap-2">
                    Email Identifier Tag:
                    <input
                        className="w-[200px] mt-[-3px] rounded-lg border border-neutral-500 pl-4 pr-8 py-1 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                        value={ (emailEventTag || safeEmailEventTag(assistantName))}
                        disabled={!enableEmailEvents || disableEdit || isPresetCheck(initialEmailEventTag)}
                        onChange={(e) => {
                            const userInput = e.target.value;
                            const newTag = userInput === EMAIL_EVENT_TAG_PREFIX || 
                                            userInput.length <= EMAIL_EVENT_TAG_PREFIX.length ? 
                                            EMAIL_EVENT_TAG_PREFIX : safeEmailEventTag(userInput);
                            setEmailEventTag(newTag);
                        }}
                        onBlur={() => {
                            if (emailEventTag === EMAIL_EVENT_TAG_PREFIX) {
                                setEmailEventTag( initialEmailEventTag );
                                return;
                            } // check if the tag is available
                            setIsCheckingTag(true);
                        }}
                    />
                
                {!isPresetCheck(initialEmailEventTag) && enableEmailEvents &&
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    {isCheckingTag ? (
                        <IconLoader2 className="animate-spin h-5 w-5 text-gray-400" />
                    ) : (<>
                        {isTagAvailable ? 
                            <div className="mt-6 flex flex-col items-end text-green-500"
                                title="Tag is available">
                                <IconCheck className="h-5 w-5" />
                                <div className="mr-[-6px]  mt-2">
                                    available
                                </div>
                            </div>
                        : (
                            <div className="mt-6 flex flex-col items-end text-red-500"
                                title="Tag is already in use by another assistant">
                                <IconAlertTriangle className="h-5 w-5" />
                                <div className="mr-[-6px]  mt-2">
                                    Not Available
                                </div>
                            </div>
                        ) }
                        </>)}
                    
                </div>}
                </div>
                <ExpansionComponent title={"Customize assistant's email response instructions"} 
                    closedWidget= { <IconPencilBolt size={18} />} 
                    content={ <>
                        {[{key: "systemPrompt", label: "System Prompt", placeholder: "Instructions for how the assistant should process emails"}, 
                        {key: "userPrompt", label: "Instructions", placeholder: "The email content will be appended to this prompt"}].map(({key, label, placeholder}) => 
                        <div key={key} title={!enableEmailEvents ? "Enable Email Events To Edit" : ""}>
                            <div className="mt-4 text-sm font-bold text-black dark:text-neutral-200">
                                {label}
                            </div>
                            <textarea
                                className="w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                style={{resize: !enableEmailEvents || disableEdit ? 'none' : 'vertical'}}
                                placeholder={placeholder}
                                value={emailEventTemplate?.[key as keyof typeof emailEventTemplate] || ''}
                                onChange={(e) => setEmailEventTemplate({
                                    ...(emailEventTemplate || {}),
                                    [key]: e.target.value
                                })}
                                rows={2}
                                disabled={!enableEmailEvents || disableEdit}
                            />
                        </div>)
                        }
                        <span className="text-sm text-gray-400 dark:text-neutral-500 flex flex-row gap-2"> 
                            <IconBulb size={16} />
                            Use the following valid placeholders to dynamically insert data using the format {"${placeholder}"}
                            <br></br>
                            {"Valid placeholders: sender, recipients, cc, bcc, timestamp, subject, contents"}
                            <br></br>
                            {"Example instructions: Acknowledge the email came from ${sender} with subject \"${subject}\" and contains: ${contents}"}
                        </span>
                        </>
                    }
                />
            </div>
            </div>
        </>
    )


  }