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
                    <span className="avatar-initial">{userInitial}</span>
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
                            <path d="M12 2L15.09 8.26L22 9L17 14.74L18.18 22.26L12 18.77L5.82 22.26L7 14.74L2 9L8.91 8.26L12 2Z" fill="currentColor"/>
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    );
};