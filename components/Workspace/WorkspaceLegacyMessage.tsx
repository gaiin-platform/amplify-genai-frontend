import React from 'react';

interface Props {
    
}

export const WorkspaceLegacyMessage: React.FC<Props> = ({  }) => {
    return  (
        <div className="border-t dark:border-white/20 overflow-x-hidden">
            <h3 className="text-lg border-b p-1 mt-1 ml-3 mr-3">Access Legacy Workspaces</h3>

            <div className="p-3">
                <p className="text-sm text-neutral-700 dark:text-neutral-400 mb-3">
                    We’ve retired the Workspaces feature, and it’s now considered a legacy feature.
                    <br></br>
                    You can still access your saved Workspace content and import it into the application. 
                    <br></br>

                    Follow these steps:
                </p>
                <ol className="list-decimal list-inside text-sm text-neutral-700 dark:text-neutral-400 mb-4">
                    <li>
                        <strong>Navigate to Settings:</strong> Click on the gear icon followed by the settings button. Select the 
                        <strong className='text-[13px] text-blue-500 dark:text-blue-400 cursor-pointer hover:underline'
                                onClick={() => window.dispatchEvent(new CustomEvent('homeChatBarTabSwitch', 
                                        { detail: { tab: "Settings" , side: "left", action: () => {
                                        window.dispatchEvent(new CustomEvent('openSettingsTrigger', {detail: {openToTab: "Legacy Workspaces"}}));
                                        }} } ))}>{" Legacy Workspaces"}
                        </strong>
                    </li>
                    <li className='mt-3' >
                        <strong>Select Your Workspace:</strong> Choose one of the saved Workspaces listed.
                    </li>
                    <li className='mt-3' >
                        <strong>Choose Content to Import:</strong> A modal will pop up, allowing you to select what Workspace content to import. Click <strong>Import Items</strong> to merge your Workspace content into Amplify.
                    </li>
                </ol>
            </div>
        </div>
    )

}
