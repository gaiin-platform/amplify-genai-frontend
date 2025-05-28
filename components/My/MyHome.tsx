import DataSourcesTable from "@/components/DataSources/DataSourcesTable";
import {FC, useContext, useState} from "react";
import {IconFiles, IconX} from "@tabler/icons-react";
import HomeContext from "@/pages/api/home/home.context";



export interface MyHomeProps {

}

export const MyHome: FC<MyHomeProps> = ({

                                  }) => {
    const {
        state: { lightMode },
    } = useContext(HomeContext);


    const {dispatch: homeDispatch, state:{statsService, featureFlags}} = useContext(HomeContext);

    return (
        <div className="pt-6 relative flex-1 overflow-hidden bg-neutral-100 dark:bg-[#343541]">

                <div className="mx-auto flex flex-col p-2 text-gray-600 dark:text-gray-400">
                    <div className="pt-3 px-2 items-center mt-6 text-left text-3xl font-bold  text-gray-600  dark:text-gray-400 flex flex-row items-center">
                        <div>
                            <IconFiles size={36}/>
                        </div>
                        <div id="Your Files" className="ml-2">Your Files</div>
                        <button 
                            onClick={() => homeDispatch({field: 'page', value: 'chat'})}
                            id="Close"
                            className="ml-auto flex items-center text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
                            title="Close">
                            <IconX size={22} /> 
                        </button>
                    </div>
                    <div className="mt-2">
                        <DataSourcesTable />
                    </div>
                </div>
        </div>
    );
}