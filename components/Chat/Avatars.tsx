import { useSession } from "next-auth/react";



export const User: React.FC = () => {
    const { data: session } = useSession();
    const userEmail = session?.user?.email;
    const userInitial = userEmail ? userEmail.charAt(0).toUpperCase() : "A";

    return (
        <div className="relative left-[-12px] flex items-center justify-center" style={{ width: '50px', height: '50px' }}>
            
            <svg width="100" height="100" viewBox="0 0 100 100">
                <defs>
                    <linearGradient id="circleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#fbff35" /> {/* Bright yellow */}
                        <stop offset="24%" stopColor="#FF6F00" /> {/* Bright orange */}
                        <stop offset="76%" stopColor="#7200bd" /> {/* Purple */}
                        <stop offset="92%" stopColor="#780000" /> {/* Dark red */}
                        <stop offset="100%" stopColor="#37005b" /> {/* Dark purple */}
                    </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="50" fill="none" stroke="url(#circleGradient)" strokeWidth="4" strokeDasharray="120 40" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="url(#circleGradient)" strokeWidth="2" strokeDasharray="110 40" />
            </svg>

            {/* Initials Label in the bottom-left corner */}
            <span
                className="text-gray-800 dark:text-[#B0BEC5] absolute text-[20px] pr-1 bg-transparent"
                style={{
                    bottom: '12px',
                    left: userInitial === "I" ? "23px" : '19px',
                    fontFamily: 'Open Sans, sans-serif',
                    fontWeight: 300
                }}
            >
                {userInitial}
            </span>
        </div>
    );
};






export const Amplify: React.FC = () => {

    return (
        <div className="relative left-[-12px] flex items-center justify-center" style={{ width: '50px', height: '50px' }}>
            
            <svg width="100" height="100" viewBox="0 0 100 100">
                <defs>
                    <linearGradient id="circleGradientAmp" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#F9E900" /> {/* Bright yellow */}
                        <stop offset="30%" stopColor="#20C997" /> {/* Teal */}
                        <stop offset="50%" stopColor="#4D9DE0" /> {/* Lighter blue */}
                        <stop offset="76%" stopColor="#00346f" /> {/* Dark blue */}
                        <stop offset="100%" stopColor="#ae34ff" /> {/* Purple */}


                    </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="50" fill="none" stroke="url(#circleGradientAmp)" strokeWidth="4" strokeDasharray="120 40" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="url(#circleGradientAmp)" strokeWidth="2" strokeDasharray="110 40" />
            </svg>

            {/* Initials Label in the bottom-left corner */}
            <span
                className="bg-gray-50 dark:bg-[#444654] text-gray-800 dark:text-[#B0BEC5] absolute text-[16px] w-[60px] pr-1 "
                style={{
                    bottom: '12px',
                    fontFamily: 'Open Sans, sans-serif',
                    fontWeight: 300
                }}
            >
                Amplify
            </span>
        </div>
    );
};



