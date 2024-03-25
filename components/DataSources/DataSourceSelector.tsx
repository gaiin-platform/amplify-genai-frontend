import {FC, useEffect, useRef, useState} from 'react';

import {useTranslation} from 'next-i18next';
import {IconFiles, IconTags, IconMessage2, IconFileDescription, IconDatabase, IconSlideshow} from "@tabler/icons-react";
import {Plugin, PluginList} from '@/types/plugin';
import {DataSource} from "@/types/chat";
import DataSourcesTable from "@/components/DataSources/DataSourcesTable";
import DataSourcesTableScrolling from "@/components/DataSources/DataSourcesTableScrolling";
import {UserTagsList} from "@/components/UserTags/UserTagsList";

interface Props {
    onDataSourceSelected: (dataSource: DataSource) => void;
    minWidth?: string;
    minHeight?: string;
}

export const DataSourceSelector: FC<Props> = ({
                                                  onDataSourceSelected,
                                                  minWidth = "620px",
                                                  minHeight = "460px"
                                              }) => {
    const {t} = useTranslation('chat');

    const selectRef = useRef<HTMLSelectElement>(null);

    const [selectedPage, setSelectedPage] = useState<string>("files");


    useEffect(() => {
        if (selectRef.current) {
            selectRef.current.focus();
        }
    }, []);

    const swapPage = (page: string) => {
        return (e: { preventDefault: () => void; }) => {
            e.preventDefault();
            setSelectedPage(page);
        }
    }

    const pageClasses = (page: string) => {
        return `inline-flex items-center px-4 py-3 rounded-lg hover:text-gray-900 hover:bg-gray-100 w-full dark:hover:bg-gray-700 dark:hover:text-white
                        ${selectedPage === page ? "text-white bg-blue-700 dark:bg-blue-600" : "bg-50 dark:bg-gray-800"}`;
    }

    return (
        <div className="md:flex rounded-t-xl border dark:border-[#454652] bg-[#e5e7eb] dark:bg-[#343541]">
            <ul className="p-1 flex-column space-y space-y-4 text-sm font-medium text-gray-500 dark:text-gray-400 md:me-4 mb-4 md:mb-0">
                <li>
                    <a href="#"
                       className={pageClasses("files")}
                       aria-current="page">
                        <div className="flex flex-row items-center pointer"
                             onClick={swapPage("files")}
                        >
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
                       className={pageClasses("tags")}
                       onClick={swapPage("tags")}
                    >
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
                       className={pageClasses("docs")}
                       onClick={swapPage("docs")}
                    >
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
                       className={pageClasses("slides")}
                       onClick={swapPage("slides")}
                    >
                        <div>
                            <IconSlideshow/>
                        </div>
                        <div className="ml-1">
                            Slides
                        </div>
                    </a>
                </li>
                {/*<li>*/}
                {/*    <a href="#"*/}
                {/*       className={pageClasses("data")}*/}
                {/*       onClick={swapPage("data")}*/}
                {/*    >*/}
                {/*        <div>*/}
                {/*            <IconDatabase/>*/}
                {/*        </div>*/}
                {/*        <div className="ml-1">*/}
                {/*            Data*/}
                {/*        </div>*/}
                {/*    </a>*/}
                {/*</li>*/}
            </ul>

            <div
                className="p-0 bg-[#ffffff] text-medium text-gray-500 dark:text-gray-400 dark:bg-[#343541] rounded-lg w-full"
                style={{minHeight: minHeight, minWidth: minWidth}}
            >
                {selectedPage === "files" && (
                    <DataSourcesTableScrolling
                        visibleColumns={["name", "createdAt", "commonType"]}
                        onDataSourceSelected={onDataSourceSelected}
                        tableParams={{
                            enableGlobalFilter: false,
                            //enableColumnActions:false,
                            enableColumnDragging: false,
                            enableColumnFilters: true,
                            enableDensityToggle: false,
                            enableTopToolbar: false,
                            enableEditing: false,
                            enableHiding: false,
                        }}
                    />
                )}
                {selectedPage === "tags" && (
                    <UserTagsList onTagSelected={(t) => {
                        const dataSource: DataSource = {
                            id: "tag://" + t + "?ragOnly=true",
                            name: "tag:" + t,
                            metadata: {},
                            type: "amplify/tag"
                        }

                        onDataSourceSelected(dataSource);
                    }}/>
                )}
                {selectedPage === "docs" && (
                    <DataSourcesTableScrolling
                        visibleColumns={["name", "createdAt", "commonType"]}
                        visibleTypes={["Word", "PDF", "Markdown", "Text", "HTML"]}
                        onDataSourceSelected={onDataSourceSelected}
                        tableParams={{
                            enableGlobalFilter: false,
                            //enableColumnActions:false,
                            enableColumnDragging: false,
                            enableColumnFilters: true,
                            enableDensityToggle: false,
                            enableTopToolbar: false,
                            enableEditing: false,
                            enableHiding: false,
                        }}
                    />
                )}
                {selectedPage === "slides" && (
                    <DataSourcesTableScrolling
                        visibleColumns={["name", "createdAt", "commonType"]}
                        visibleTypes={["PowerPoint", "Google Slides"]}
                        onDataSourceSelected={onDataSourceSelected}
                        tableParams={{
                            enableGlobalFilter: false,
                            //enableColumnActions:false,
                            enableColumnDragging: false,
                            enableColumnFilters: true,
                            enableDensityToggle: false,
                            enableTopToolbar: false,
                            enableEditing: false,
                            enableHiding: false,
                        }}
                    />
                )}
            </div>
        </div>

    );
};
