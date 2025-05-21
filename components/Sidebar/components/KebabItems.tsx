import HomeContext from "@/pages/api/home/home.context";
import { CheckItemType } from "@/types/checkItem";
import { FC, useContext, useState } from "react";
import React from "react";

export interface ItemProps {
  label : string, 
  handleAction : () => void
  icon: JSX.Element,
  title?: string;
  id?: string;
}
//min-w-[${minWidth}px]
export const KebabItem: FC<ItemProps> = ({label, handleAction, icon, title=''}) => {
  return (
    <div className={`border-b dark:border-white/20`} title={title}>
      <button   
        id={label}
        key={label}
        value={label}
        onClick={handleAction}
        className={`w-full items-center gap-2 flex flex-row pr-2 pl-2 py-1.5 cursor-pointer hover:bg-neutral-200 dark:hover:bg-[#343541]/90 transition-all duration-200`}>
        <div className="text-neutral-900 dark:text-neutral-100 flex-shrink-0 enhanced-icon">{icon} </div>
        <span className="sidebar-text">{label}</span>
      </button>
    </div>);
}


interface ActionProps {
  label: string;
  type: CheckItemType
  handleAction: () => void;
  setIsMenuOpen: (isOpen: boolean) => void;
  setActiveItem: (option: actionItemAttr | null) => void;
  dropFolders: (isOpen: boolean) => void;
  icon: JSX.Element;
  id?: string;
}

export interface actionItemAttr {
    name : string, 
    actionLabel : string,
    clickAction : () => void
    type: CheckItemType
}

export const KebabActionItem: FC<ActionProps> = ({label, type, handleAction, setIsMenuOpen, setActiveItem, dropFolders, icon }) => {
  const { dispatch: homeDispatch, state: { checkingItemType}} = useContext(HomeContext);

  const selectedOptionLabel = (label: string) => {
    if (label === 'Tag') return 'Tagging';
    return label.substring(0, label.length-1) + 'ing';
  }

  const item: actionItemAttr = {
    name : label, 
    actionLabel : selectedOptionLabel(label),
    clickAction : handleAction,
    type: type
  }

  const handleClick = () => {
    setIsMenuOpen(false);
    homeDispatch({field: 'checkingItemType', value: type});
    setActiveItem(item);
    dropFolders(!type.includes('Folders'));
  };


  return (
    <div className="border-b dark:border-white/20"
      title={`${label} ${type.includes('Folders') ? "Entire Folder" : type}`}>
      <button 
        id={label}
        key={label}
        value={label}
        onClick={handleClick}
        className="w-full flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-neutral-200 dark:hover:bg-[#343541]/90 transition-all duration-200">
        <div className="text-neutral-900 dark:text-neutral-100 enhanced-icon">{icon}</div>
        <span className="sidebar-text">{label}</span>  
      </button>
    </div>
  );
};


interface MenuItemsProps {
  label: string;
  xShift?: number;
  children: (React.ReactElement<ItemProps> | React.ReactElement<ItemProps>[] |
             React.ReactElement<ActionProps> | React.ReactElement<ActionProps>[] |
             React.ReactElement<MenuItemsProps> | React.ReactElement<MenuItemsProps>[]) | React.ReactNode; 
  minWidth?: number;
}

export const KebabMenuItems: FC<MenuItemsProps> = ({ label, xShift=220, minWidth=72, children}) => {
  const childrenArray = React.Children.toArray(children)
                             .filter(Boolean) as React.ReactElement<ItemProps | ActionProps | MenuItemsProps>[];

  const [isSubMenuVisible, setIsSubMenuVisible] = useState<boolean>(false);
  
  return (
    <div
    id="subMenu"
    className="border-b dark:border-white/20 relative"
    onMouseEnter={() => setIsSubMenuVisible(true)}
    onMouseLeave={() => setIsSubMenuVisible(false)}
    >
      <button
        className="w-full flex items-center justify-between pr-2 pl-2 py-1.5 cursor-pointer hover:bg-neutral-200 dark:hover:bg-[#343541]/90 transition-all duration-200"
        onClick={() => setIsSubMenuVisible(!isSubMenuVisible)}
      >
        <span className="sidebar-text">{`< ${label}`}</span>
        <span className="text-gray-500 dark:text-gray-400">›</span>
      </button>
      
      {isSubMenuVisible && (
        <div 
          className="absolute left-full top-0 z-[100]"
          style={{ transform: 'translateX(1px)' }}
        >
          <div className="bg-neutral-100 dark:bg-[#202123] border border-neutral-200 dark:border-neutral-600 rounded-lg shadow-lg overflow-hidden"
            style={{ minWidth: `${minWidth}px`, maxWidth: '200px' }}>
            {childrenArray}
          </div>
        </div>
      )}
    </div>
  );
};