import HomeContext from "@/pages/api/home/home.context";
import { CheckItemType } from "@/types/checkItem";
import { FC, useContext, useState } from "react";
import React from "react";

export interface ItemProps {
  label : string, 
  handleAction : () => void
  icon: JSX.Element
}
//min-w-[${minWidth}px]
export const KebabItem: FC<ItemProps> = ({label, handleAction, icon}) => {
  return (
    <div className={`border-b dark:border-white/20`}>
      <button   
        key={label}
        value={label}
        onClick={handleAction}
        className={`w-full items-center gap-1 flex flex-row pr-1 pl-1 cursor-pointer hover:bg-neutral-200 dark:hover:bg-[#343541]/90`}>
        <div className="text-neutral-900 dark:text-neutral-100 flex-shrink-0">{icon} </div>
         {label}
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
    <div className="flex items-center gap-1 flex-row pr-1 pl-1 cursor-pointer border-b dark:border-white/20 hover:bg-neutral-200 dark:hover:bg-[#343541]/90">
      <div className="text-neutral-900 dark:text-neutral-100">{icon}</div>
      <button 
        key={label}
        value={label}
        onClick={handleClick} >  
        {label}  
      </button>
    </div>
  );
};


interface MenuItemsProps {
  label: string;
  xShift?: number;
  children: (React.ReactElement<ItemProps> | React.ReactElement<ItemProps>[] |
             React.ReactElement<ActionProps> | React.ReactElement<ActionProps>[] |
             React.ReactElement<MenuItemsProps> | React.ReactElement<MenuItemsProps>[]); 
  minWidth?: number;
}

export const KebabMenuItems: FC<MenuItemsProps> = ({ label, xShift=220, minWidth=72, children}) => {
  const childrenArray = React.Children.toArray(children) as React.ReactElement<ItemProps | ActionProps | MenuItemsProps>[];
  const [isSubMenuVisible, setIsSubMenuVisible] = useState<boolean>(false);

  const xShiftPercentage = `-${xShift}%`;
  
  return (
    <div
    className={`pr-1 pl-1 border-b dark:border-white/20 cursor-pointer dark:border-white/20 hover:bg-neutral-200 dark:hover:bg-[#343541]/90 flex w-full items-center `}
      onMouseEnter={() => setIsSubMenuVisible(true)}
      onMouseLeave={() => setIsSubMenuVisible(false)}
    >
      {`< ${label}`}
      {isSubMenuVisible && (
        <div 
          className={`relative`} 
          style={{ display: isSubMenuVisible ? 'block' : 'none', top: `-11px`}}>
          <div className={`flex-grow absolute bg-neutral-100 dark:bg-[#202123] text-neutral-900 rounded border border-neutral-200 dark:border-neutral-600 dark:text-white z-50`}
            style={{ transform: `translateX(${xShiftPercentage})`, minWidth: `${minWidth}px`}}>    
            {childrenArray} 
          </div>
        </div>
      )}
    </div>
  );
};

