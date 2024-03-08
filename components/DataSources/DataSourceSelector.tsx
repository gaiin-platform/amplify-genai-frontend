import { FC, useEffect, useRef } from 'react';

import { useTranslation } from 'next-i18next';
import {IconFiles, IconTags, IconMessage2, IconFileDescription, IconDatabase, IconSlideshow} from "@tabler/icons-react";
import { Plugin, PluginList } from '@/types/plugin';
import {DataSource} from "@/types/chat";
import DataSourcesTable from "@/components/DataSources/DataSourcesTable";
import DataSourcesTableScrolling from "@/components/DataSources/DataSourcesTableScrolling";

interface Props {
    onDataSourceSelected: (dataSource: DataSource) => void;
}

export const DataSourceSelector: FC<Props> = ({
                                            onDataSourceSelected
                                        }) => {
    const { t } = useTranslation('chat');

    const selectRef = useRef<HTMLSelectElement>(null);


    useEffect(() => {
        if (selectRef.current) {
            selectRef.current.focus();
        }
    }, []);

    return (
                <div className="md:flex rounded-top border dark:border-0 bg-[#e5e7eb] dark:bg-[#343541]">
                    <ul className="p-1 flex-column space-y space-y-4 text-sm font-medium text-gray-500 dark:text-gray-400 md:me-4 mb-4 md:mb-0">
                        <li>
                            <a href="#"
                               className="inline-flex items-center px-4 py-3 text-white bg-blue-700 rounded-lg active w-full dark:bg-blue-600"
                               aria-current="page">
                                <div className="flex flex-row items-center">
                                    <div>
                                        <IconFiles/>
                                    </div>
                                    <div className="ml-1">
                                        Files
                                    </div>
                                </div>
                            </a>
                        </li>
                        <li>
                            <a href="#"
                               className="inline-flex items-center px-4 py-3 rounded-lg hover:text-gray-900 bg-gray-50 hover:bg-gray-100 w-full dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-white">
                                <div>
                                    <IconTags/>
                                </div>
                                <div className="ml-1">
                                    Tags
                                </div>
                            </a>
                        </li>
                        <li>
                            <a href="#"
                               className="inline-flex items-center px-4 py-3 rounded-lg hover:text-gray-900 bg-gray-50 hover:bg-gray-100 w-full dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-white">
                                <div>
                                    <IconFileDescription/>
                                </div>
                                <div className="ml-1">
                                    Docs
                                </div>
                            </a>
                        </li>
                        <li>
                            <a href="#"
                               className="inline-flex items-center px-4 py-3 rounded-lg hover:text-gray-900 bg-gray-50 hover:bg-gray-100 w-full dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-white">
                                <div>
                                    <IconSlideshow/>
                                </div>
                                <div className="ml-1">
                                    Slides
                                </div>
                            </a>
                        </li>
                        <li>
                            <a className="inline-flex items-center px-4 py-3 text-gray-400 rounded-lg cursor-not-allowed bg-gray-50 w-full dark:bg-gray-800 dark:text-gray-500">
                                <div>
                                    <IconDatabase/>
                                </div>
                                <div className="ml-1">
                                    Data
                                </div>
                            </a>
                        </li>
                    </ul>
                    <div
                        className="p-0 bg-gray-50 text-medium text-gray-500 dark:text-gray-400 dark:bg-gray-800 rounded-lg w-full">
                        <DataSourcesTableScrolling
                            visibleColumns={["name","createdAt","commonType"]}
                            onDataSourceSelected={onDataSourceSelected}
                            tableParams={{
                                enableGlobalFilter:false,
                                //enableColumnActions:false,
                                enableColumnDragging:false,
                                enableColumnFilters:true,
                                enableDensityToggle:false,
                                enableTopToolbar:false,
                                enableEditing:false,
                                enableHiding:false,
                            }}
                        />
                    </div>
                </div>

    );
};
