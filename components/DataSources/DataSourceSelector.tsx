import {FC, useContext, useEffect, useRef, useState} from 'react';

import {useTranslation} from 'next-i18next';
import {IconFiles, IconTags, IconFileDescription, IconSlideshow, IconLoader2} from "@tabler/icons-react";
import {DataSource} from "@/types/chat";
import DataSourcesTableScrolling from "@/components/DataSources/DataSourcesTableScrolling";
import {UserTagsList} from "@/components/UserTags/UserTagsList";
import { getConnectedIntegrations } from '@/services/oauthIntegrationsService';
import HomeContext from '@/pages/api/home/home.context';
import { capitalize } from '@/utils/app/data';
import DataSourcesTableScrollingIntegrations from './DataSourcesTableScrollingIntegrations';
import { translateIntegrationIcon } from '../Integrations/IntegrationsDialog';
import { getDriveFileIntegrationTypes } from '@/utils/app/integrations';

interface Props {
    onDataSourceSelected: (dataSource: DataSource) => void;
    minWidth?: string;
    height?: string;
    onClose?: () => void;
    disallowedFileExtensions?: string[];
    showActionButtons?: boolean;
    onIntegrationDataSourceSelected?: (file: File) => void;
}

export const DataSourceSelector: FC<Props> = ({ onDataSourceSelected,
                                                  minWidth = "620px",
                                                  height,
                                                  onClose,
                                                  disallowedFileExtensions,
                                                  showActionButtons = false,
                                                  onIntegrationDataSourceSelected
                                              }) => {
    const {t} = useTranslation('chat');
    const { state: { featureFlags } } = useContext(HomeContext);

    const selectRef = useRef<HTMLSelectElement>(null);

    const [selectedPage, setSelectedPage] = useState<string>("files");
    const [loading, setLoading] = useState<boolean>(true);
    const [userIntegrations, setUserIntegrations] = useState<string[] | null>(null);

    useEffect(() => {
        const setupIntegrationFiles = async () => {
            let integrations: any = [];
            if (featureFlags.integrations) {
                const result = await getConnectedIntegrations();
                const connected = !result?.success ? [] : getDriveFileIntegrationTypes(result.data);
                integrations = connected;
            }
            setLoading(false);
            setUserIntegrations(integrations);
         }
    
         
        if (loading) setupIntegrationFiles();
        
    }, [loading]);

    const getIntegrationName = (integration: string) => {
        switch (integration) {
            case "microsoft_drive":
                return "OneDrive";
            case "microsoft_sharepoint":
                return "SharePoint";
        }
        return capitalize(integration.split('_')[0]);
    }

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
        return `inline-flex items-center px-4 py-3 rounded-lg hover:text-gray-900 hover:bg-blue-100 w-full dark:hover:bg-gray-700 dark:hover:text-white
                        ${selectedPage === page ? "text-white bg-blue-400 dark:bg-blue-700" : "bg-gray-100 dark:bg-gray-800"}`;
    }

    return (
        <div id="viewFilesMenu" className="md:flex rounded-t-xl border dark:border-[#454652] bg-[#e5e7eb] dark:bg-[#343541]">
            <ul className="w-[160px] p-1 flex-column space-y space-y-4 text-sm font-medium text-gray-500 dark:text-gray-400 md:me-4 mb-4 md:mb-0">
                <li>
                    <a href="#"
                       id="fileSection"
                       className={pageClasses("files")}
                       onClick={swapPage("files")}
                       aria-current="page">
                        <div className="group flex flex-row items-center pointer">
                            <div>
                                <IconFiles className="icon-pop-group"/>
                            </div>
                            <div className="ml-1">
                                Files
                            </div>
                        </div>
                    </a>
                </li>
                <li>
                    <a href="#"
                       id="tagSection"
                       className={pageClasses("tags")}
                       onClick={swapPage("tags")}
                    >
                        <div className="group flex flex-row items-center pointer">
                            <div>
                                <IconTags className="icon-pop-group"/>
                            </div>
                            <div className="ml-1">
                                Tags
                            </div>
                        </div>
                    </a>
                </li>
                <li>
                    <a href="#"
                       id="docsSection"
                       className={pageClasses("docs")}
                       onClick={swapPage("docs")}
                    >
                        <div className="group flex flex-row items-center pointer">
                            <div>
                                <IconFileDescription className="icon-pop-group"/>
                            </div>
                            <div className="ml-1">
                                Docs
                            </div>
                        </div>
                    </a>
                </li>
                <li>
                    <a href="#"
                       id="slideSection"
                       className={pageClasses("slides")}
                       onClick={swapPage("slides")}
                    >
                        <div className="group flex flex-row items-center pointer">
                            <div>
                                <IconSlideshow className="icon-pop-group"/>
                            </div>
                            <div className="ml-1">
                                Slides
                            </div>
                        </div>
                    </a>
                </li>
                
                

                {loading ?
                <div className='bottom-10'>
                    <IconLoader2 className="animate-spin w-5 h-5 inline-block flex justify-center w-full" />
                </div> :
                (userIntegrations && 
                    userIntegrations.map((key) => (
                    <li key={key}>
                        <a href="#"
                            className={pageClasses(key)}
                            onClick={swapPage(key)}>
                            <div className="group flex flex-row items-center pointer">
                                <div>
                                    {translateIntegrationIcon(key)}
                                </div>
                                <div className="ml-2">
                                    {getIntegrationName(key)}
                                </div>
                            </div>
                        </a>
                    </li>
                )))
                }
                
                { onClose && <button
                    type="button"
                    className="px-4 py-3 rounded-lg hover:text-gray-900 hover:bg-blue-100 bg-gray-100 w-full dark:hover:bg-gray-700 dark:hover:text-white bg-50 dark:bg-gray-800"
                    onClick={onClose}
                >
                    Close
                </button>}
                <br></br>
                
                
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
                style={{height: height ?? "", minWidth: minWidth, minHeight:'400px'}}
            >
                {selectedPage === "files" && (
                    <DataSourcesTableScrolling
                        height={height}
                        visibleColumns={ showActionButtons ? ["name", "id", "createdAt", "commonType", "embeddingStatus", "delete"] 
                                                           : ["name", "createdAt", "commonType", "embeddingStatus"]}
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
                        height={height}
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
                        height={height}
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
                {userIntegrations &&
                 userIntegrations.map((key) =>
                    <div key={key} style={{ display: selectedPage === key ? 'block' : 'none' }}>
                     <DataSourcesTableScrollingIntegrations
                        onDataSourceSelected={onIntegrationDataSourceSelected}
                        disallowedFileExtensions={disallowedFileExtensions}
                        driveId={key}
                        height={height}
                        visibleColumns={["name", "mimeType", "size"]}
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
                        enableDownload={onClose ? false : true}
                    />
                    </div>)
                }
            
            </div>
        </div>

    );
};
