import { useSession } from "next-auth/react";

export const User: React.FC = () => {
    const { data: session } = useSession();
    const userEmail = session?.user?.email;
    const userInitial = userEmail ? userEmail.charAt(0).toUpperCase() : "A";

    return (
        <div className="enhanced-avatar enhanced-avatar-user">
            <div className="avatar-background">
                <div className="avatar-gradient-ring"></div>
                <div className="avatar-inner-circle">
                    <span className="avatar-initial" 
                          style={{fontFamily: 'Open Sans, sans-serif'}}>{userInitial}</span>
                </div>
            </div>
        </div>
    );
};

export const Amplify: React.FC = () => {
    return (
        <div className="enhanced-avatar enhanced-avatar-assistant">
            <div className="avatar-background">
                <div className="avatar-gradient-ring avatar-gradient-assistant"></div>
                <div className="avatar-inner-circle avatar-inner-assistant">
                    <div className="amplify-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M7 4L5 10L1 11L5 12L7 18L9 12L13 11L9 10L7 4Z" fill="currentColor"/>
                            <path d="M18 3L17 6L14 7L17 8L18 11L19 8L22 7L19 6L18 3Z" fill="currentColor"/>
                            <path d="M16 15L15 18L12 19L15 20L16 23L17 20L20 19L17 18L16 15Z" fill="currentColor"/>
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    );
};