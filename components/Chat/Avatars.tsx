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
                            <path d="M12 2L9.5 8.5L3 9L8 14L7 21L12 18.5L17 21L16 14L21 9L14.5 8.5L12 2Z" fill="currentColor"/>
                            <path d="M7.5 3.5L6.5 6L4 6.5L6 8.5L5.5 11L7.5 9.5L9.5 11L9 8.5L11 6.5L8.5 6L7.5 3.5Z" fill="currentColor" opacity="0.7"/>
                            <path d="M17.5 4L16.8 5.8L15 6.5L16.8 7.2L17.5 9L18.2 7.2L20 6.5L18.2 5.8L17.5 4Z" fill="currentColor" opacity="0.5"/>
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    );
};