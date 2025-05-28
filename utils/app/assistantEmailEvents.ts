import { addAllowedSender, removeAllowedSender } from "@/services/emailEventService";

export const EMAIL_EVENT_TAG_PREFIX = "my_";

export const isPresetEmailEventTag = (initialTag: string | undefined): boolean => {
  if (!initialTag) return false;
  return !initialTag.startsWith(EMAIL_EVENT_TAG_PREFIX);
}

export const safeEmailEventTag = (tag: string) => {
    if (!tag || tag === EMAIL_EVENT_TAG_PREFIX) return `${EMAIL_EVENT_TAG_PREFIX}assistant`;
    if (!tag.startsWith(EMAIL_EVENT_TAG_PREFIX)) tag = `${EMAIL_EVENT_TAG_PREFIX}${tag}`;
    return tag.trim()
              .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace invalid chars with underscore
              .replace(/__+/g, '_')            // Replace multiple consecutive underscores with a single one
              .toLowerCase();
}

export const constructAstEventEmailAddress = (tag: string, userEmail: string, aiEmailDomain: string | null) => {
    const placeholder = '<Assistant_Name>';
    return `${userEmail?.split('@')[0]}+${tag || placeholder}@${aiEmailDomain || 'yourdomain.ai'}`;
};

/**
 * Formats an email event template for API submission
 * @param template The template with userPrompt and systemPrompt
 * @returns Array of prompt messages in the required format
 */
export const formatEmailEventTemplate = ( template: {userPrompt?: string, systemPrompt?: string} | null | undefined ) => {
  if (!template) return [];

  const formattedTemplate: any[] = [];
  if (template?.systemPrompt) formattedTemplate.push({role: "system", content: template.systemPrompt});
  if (template?.userPrompt) formattedTemplate.push({role: "user", content: template.userPrompt});
  return formattedTemplate;
}

/**
 * Compares two email event templates to check if they are equivalent
 */
export const compareEmailEventTemplates = (
  template1: {userPrompt: string, systemPrompt: string} | null | undefined, 
  template2: {userPrompt: string, systemPrompt: string} | null | undefined
): boolean => {
    // If both are null/undefined, they're considered equal
    if (!template1 && !template2) return true;
    
    // If only one is null/undefined, they're not equal
    if (!template1 || !template2) return false;
    
    // Direct comparison of properties
    return template1.userPrompt === template2.userPrompt && 
           template1.systemPrompt === template2.systemPrompt;
}

// Keep the original comparison function for when we just need the difference
export const compareAllowedSenders = (
  oldSenders: string[] = [], 
  newSenders: string[] = []
): { 
  sendersToAdd: string[], 
  sendersToRemove: string[] 
} => {
    // Convert to Sets for efficient comparisons
    const oldSet = new Set(oldSenders.map(email => email.toLowerCase().trim()));
    const newSet = new Set(newSenders.map(email => email.toLowerCase().trim()));
    
    // Find emails to add (in new list but not in old list)
    const sendersToAdd = newSenders.filter(email => 
      !oldSet.has(email.toLowerCase().trim())
    );
    
    // Find emails to remove (in old list but not in new list)
    const sendersToRemove = oldSenders.filter(email => 
      !newSet.has(email.toLowerCase().trim())
    );
    
    return { sendersToAdd, sendersToRemove };
}


/**
 * Compares two lists of allowed sender emails, calls API to update, and returns operation results
 * @param tag The email event tag
 * @param oldSenders Previous list of allowed senders
 * @param newSenders Current list of allowed senders
 * @returns Object containing operation results
 */
export const updateAllowedSenders = async (
    tag: string,
    oldSenders: string[] = [], 
    newSenders: string[] = []
  ): Promise<{ 
    success: boolean,
    failedToAdd: {email: string, error: string}[],
    failedToRemove: {email: string, error: string}[]
  }> => {
      const {sendersToAdd, sendersToRemove} = compareAllowedSenders(oldSenders, newSenders);
      if (sendersToAdd.length === 0 && sendersToRemove.length === 0) return {success: true, failedToAdd: [], failedToRemove: []};

      const processSenders = async (senders: string[], executeAction: (sender: string) => Promise<{success: boolean, message: string}>) => {
        const failed: {email: string, error: string}[] = [];
        for (const sender of senders) {
            try {
                const response = await executeAction(sender);
                if (!response.success) failed.push({ email: sender, error: response.message || 'Unknown error' });
            } catch (error) {
                failed.push({ 
                email: sender, 
                error: error instanceof Error ? error.message : 'Unknown error' 
                });
            }
        }
        return failed;
      }
      const failedToAdd: any[] = await processSenders(sendersToAdd, 
                                 async (sender) => await addAllowedSender(tag, sender));
      
      const failedToRemove: any[] = await processSenders(sendersToRemove, 
                                    async (sender) => await removeAllowedSender(tag, sender));
      
      return { 
        success: failedToAdd.length === 0 && failedToRemove.length === 0, 
        failedToAdd, 
        failedToRemove 
      };
  }
  
