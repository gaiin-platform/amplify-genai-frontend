import {IconFileImport} from '@tabler/icons-react';
import {FC} from 'react';

import {useTranslation} from 'next-i18next';

import {SupportedExportFormats} from '@/types/export';

import {SidebarButton} from '../Sidebar/SidebarButton';
import React from 'react';

interface Props {
    onImport: (data: SupportedExportFormats) => void;
}

export const ImportFromUrl: FC<Props> = ({onImport}) => {
    const {t} = useTranslation('sidebar');
    return (
        <>

            <SidebarButton
                text={t('Import Share')}
                icon={<IconFileImport size={18}/>}
                onClick={() => {
                    const url = window.prompt("Paste the share link here", "");
                    const id = url?.split("/").slice(-1);

                    alert(id);

                    if (url) {
                        fetch(url)
                            .then((response) => response.json())
                            .then((json) => {
                                onImport(json);
                            });
                    }
                }}
            />
        </>
    );
};
