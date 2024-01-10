import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

const useSidebarState = () => {
    const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
    const [rightSidebarOpen, setRightSidebarOpen] = useState(true);

    return {
        leftSidebarOpen,
        setLeftSidebarOpen,
        rightSidebarOpen,
        setRightSidebarOpen
    };
};

export const SidebarContext = createContext({
    leftSidebarOpen: true,
    setLeftSidebarOpen: (open: boolean) => { },
    rightSidebarOpen: true,
    setRightSidebarOpen: (open: boolean) => { },
});

export const useSidebar = () => {
    const context = useContext(SidebarContext);
    if (!context) {
        throw new Error("useSidebar must be used within a SidebarProvider");
    }
    return context;
};

interface SidebarProviderProps {
    children: ReactNode;
}

export const SidebarProvider: React.FC<SidebarProviderProps> = ({ children }) => {
    const sidebarState = useSidebarState();

    return (
        <SidebarContext.Provider value={sidebarState}>
            {children}
        </SidebarContext.Provider>
    );
};
