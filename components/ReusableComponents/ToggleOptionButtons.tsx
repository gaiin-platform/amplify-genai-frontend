// ToggleOption Interface
interface ToggleOption {
    id: string;
    name: string;
    title: string;
    icon?: React.ElementType; 
  }

  // ToggleButtonGroup Component
export interface ToggleButtonGroupProps {
    options: ToggleOption[];
    selected: string;
    onToggle: (name: string) => void;
    activeColor?: string;
  }
  
export const ToggleOptionButtons: React.FC<ToggleButtonGroupProps> = ({ options, selected, onToggle, activeColor }) => {
    return (
      <div className="flex items-center rounded-md border border-neutral-600 bg-neutral-200 dark:bg-[#39394a] p-1">
        {options.map((option) => (
        <div key={option.id}>
          <ToggleButton
            id={option.id}
            selected={selected}
            name={option.name}
            title={option.title}
            icon={option.icon}
            toggleSwitch={onToggle}
            activeColor={activeColor}
          /> </div>
        ))}
        
      </div>
    );
  };
  
  // ToggleButton Component
  interface ToggleProps {
    id: string;
    selected: string;
    name: string;
    title: string;
    icon: React.ElementType | undefined;
    toggleSwitch: (name: string) => void;
    activeColor?: string;
  }
  
  const ToggleButton: React.FC<ToggleProps> = ({ id, selected, name, title, icon:Icon, toggleSwitch, activeColor }) => {
    const isActive = selected === id;
  
    return (
      <button key={id}
        onMouseDown={(e) => e.preventDefault()}
        className={`flex flex-row gap-2 py-1 px-2 text-[12px] rounded-full transition-all duration-300 focus:outline-none whitespace-nowrap ${
          isActive
            ? `bg-white dark:bg-[#1f1f29]  font-bold transform scale-105 ${activeColor || 'text-neutral-900 dark:text-neutral-100'}`
            : 'bg-transparent text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-[#31313f]'
        }`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isActive) toggleSwitch(id);
        }}
        title={title}
      >
        {Icon && <div className="mt-0.5">{<Icon size={16}/>}</div>}
        <label className="mr-0.5">{name}</label>
      </button>
    );
  };
  