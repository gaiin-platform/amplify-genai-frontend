import { useState } from "react";
import ApiItem from "./ApiItem";
import { opsSearchToggleButtons } from "../Admin/AdminComponents/Ops";
import { OpBindings, OpDef } from "@/types/op";

interface ApiItemSelectorProps {
    availableApis: any[] | null;
    selectedApis: OpDef[];
    setSelectedApis: (apis: OpDef[]) => void;
    disableSelection?: boolean;
    apiFilter?: (api: any[]) => any[];
    onClickApiItem?: (api: OpDef) => void;
    showDetails?: boolean;
    allowConfiguration?: boolean;
  }
  
export const ApiItemSelector: React.FC<ApiItemSelectorProps> = ({ 
    availableApis, 
    selectedApis, 
    setSelectedApis, 
    apiFilter = (apis) => apis,
    onClickApiItem,
    disableSelection,
    showDetails,
    allowConfiguration = false
  }) => {

    const [opSearchBy, setOpSearchBy] = useState<"name" | 'tag'>('name'); 
    const [apiSearchTerm, setApiSearchTerm] = useState<string>(''); 

    const handleUpdateApiItem = (id: string, checked: boolean, bindings?: OpBindings) => {
        const api = availableApis?.find((api) => api.id === id);
        if (!api) return;
        
        const updatedApi = { ...api, bindings };
        
        if (checked) {
            // Check if API is already selected
            const existingIndex = selectedApis.findIndex(selectedApi => selectedApi.id === id);
            
            if (existingIndex >= 0) {
                // Update existing API with new bindings
                const newSelectedApis = [...selectedApis];
                newSelectedApis[existingIndex] = updatedApi;
                setSelectedApis(newSelectedApis);
            } else {
                // Add new API
                setSelectedApis([...selectedApis, updatedApi]);
            }
        } else {
            // Remove API
            setSelectedApis(selectedApis.filter((api) => api.id !== id));
        }
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
        {displayedApis.length > 0  && opsSearchToggleButtons(opSearchBy, setOpSearchBy, apiSearchTerm, setApiSearchTerm, " mt-6 ml-auto mb-6", '', showDetails)}
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
                            showDetails={showDetails}
                            allowConfiguration={allowConfiguration}
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