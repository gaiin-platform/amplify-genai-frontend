import React, { FC, useEffect, useState } from 'react';
import { getLatestDataDisclosure } from "@/services/dataDisclosureService";
import { IconExternalLink } from '@tabler/icons-react';

interface Props {
    open: boolean;
}

export const DataDisclosureViewer: FC<Props> = ({ open }) => {
    const [dataDisclosure, setDataDisclosure] = useState<{url: string, html: string | null} | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDataDisclosure = async () => {
            if (!open) return;

            setIsLoading(true);
            setError(null);

            try {
                const latestDisclosure = await getLatestDataDisclosure();
                const latestDisclosureBodyObject = JSON.parse(latestDisclosure.body);
                const latestDisclosureUrlPDF = latestDisclosureBodyObject.pdf_pre_signed_url;
                const latestDisclosureHTML = latestDisclosureBodyObject.html_content;

                setDataDisclosure({
                    url: latestDisclosureUrlPDF,
                    html: latestDisclosureHTML
                });
            } catch (err) {
                console.error('Failed to fetch data disclosure:', err);
                setError('Failed to load data disclosure. Please try again later.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchDataDisclosure();
    }, [open]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">Loading data disclosure...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <p className="text-red-500 dark:text-red-400">{error}</p>
            </div>
        );
    }

    if (!dataDisclosure) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <p className="text-gray-600 dark:text-gray-400">No data disclosure available.</p>
            </div>
        );
    }

    return (
        <div className="settings-card">
            <div className="settings-card-header flex flex-row items-center gap-4 justify-between">
                <div>
                    <h3 className="settings-card-title">Amplify Data Disclosure Agreement</h3>
                    <p className="settings-card-description">{"Review Amplify's data handling and privacy practices"}</p>
                </div>
                {dataDisclosure.url && (
                    <a
                        href={dataDisclosure.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-blue-200 dark:bg-blue-700 hover:bg-blue-600 dark:text-white rounded-md transition-colors duration-200"
                    >
                        <IconExternalLink size={18} />
                        Download PDF
                    </a>
                )}
            </div>

            <div className="settings-card-content">
                {dataDisclosure.html ? (
                    <div
                        className="data-disclosure-content p-4 border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-[#343541] max-h-[600px] overflow-y-auto"
                        dangerouslySetInnerHTML={{ __html: dataDisclosure.html }}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center min-h-[200px]">
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            The data disclosure content is not available for preview.
                        </p>
                        {dataDisclosure.url && (
                            <a
                                href={dataDisclosure.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-600 underline"
                            >
                                Please download the PDF to view the full disclosure
                            </a>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};