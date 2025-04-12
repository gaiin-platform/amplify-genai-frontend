import { useState } from "react";
import ApiItem from "./ApiItem";
import { opsSearchToggleButtons } from "../Admin/AdminComponents/Ops";


interface ApiItemSelectorProps {
    availableApis: any[] | null;
    selectedApis: any[];
    setSelectedApis: (apis: any[]) => void;
    disableSelection?: boolean;
    apiFilter?: (api: any[]) => any[];
    onClickApiItem?: (api: any) => void;
  }
  
export const ApiItemSelector: React.FC<ApiItemSelectorProps> = ({ 
    availableApis, 
    selectedApis, 
    setSelectedApis, 
    apiFilter = (apis) => apis,
    onClickApiItem,
    disableSelection
  }) => {

    const [opSearchBy, setOpSearchBy] = useState<"name" | 'tag'>('name'); 
    const [apiSearchTerm, setApiSearchTerm] = useState<string>(''); 

    const handleUpdateApiItem = (id: string, checked: boolean) => {
        const api = availableApis?.find((api) => api.id === id);
        if (!api) return;
        const newSelectedApis = checked ? [...selectedApis, api] : selectedApis.filter((api) => api.id !== id);
        setSelectedApis(newSelectedApis);
    }

    const displayedApis = availableApis ? apiFilter(availableApis) : [];

    const filteredApis = displayedApis?.filter((api) => 
        apiSearchTerm ? (opSearchBy === 'name' 
            ? api.name.toLowerCase().includes(apiSearchTerm.toLowerCase().replace(/ /g, ''))
            : (api.tags?.join("") ?? '').toLowerCase().includes(apiSearchTerm.toLowerCase())) 
        : true
    ) || [];

    return (
        <>
        {displayedApis.length > 0  && opsSearchToggleButtons(opSearchBy, setOpSearchBy, apiSearchTerm, setApiSearchTerm, " mt-4 ml-auto mr-2 mb-6", '')}
        {filteredApis.length > 0 ? (
                <div className="max-h-[500px] overflow-y-auto">
                    {filteredApis.sort((a, b) => a.name[0].localeCompare(b.name[0]))
                       .map((api, index) => (
                        <ApiItem
                            selected={!!selectedApis?.some((selectedApi) => selectedApi.id === api.id)}
                            key={index}
                            api={api}
                            index={index}
                            onChange={disableSelection ? undefined : handleUpdateApiItem} 
                            onClick={onClickApiItem}
                        />
                    ))}
                </div>
            ) : (
                <div className="p-4 text-center text-neutral-500 dark:text-neutral-400">
                    {availableApis && displayedApis.length > 0 
                        ? 'No APIs match your search criteria'
                        : 'No Internal APIs Available'
                    }
                </div>
            )
        }
        </>
    )
}