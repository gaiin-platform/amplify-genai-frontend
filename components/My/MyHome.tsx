import DataSourcesTable from "@/components/DataSources/DataSourcesTable";
import {FC, useContext, useState} from "react";
import {IconFiles} from "@tabler/icons-react";
import HomeContext from "@/pages/api/home/home.context";

export interface MyHomeProps {

}

export const MyHome: FC<MyHomeProps> = ({

                                  }) => {
    const {
        state: { lightMode },
    } = useContext(HomeContext);


    const [responseTokenRatio, setResponseTokenRatio] = useState(
        3
    );



    return (
        <div className="relative flex-1 overflow-hidden bg-white dark:bg-[#343541]">

                <div className="mx-auto flex flex-col p-3">
                    <div className="mt-6 text-left text-4xl font-bold text-black dark:text-white flex flex-row items-center">
                        <div className="p-3">
                            <IconFiles size={36}/>
                        </div>
                        <div>Your Files</div>
                    </div>
                    <div className="mt-2">
                        <DataSourcesTable />
                    </div>
                </div>
        </div>
    );
}