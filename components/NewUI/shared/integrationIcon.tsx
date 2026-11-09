/**
 * integrationIcon — the logo for an integration id.
 *
 * Ids map onto files in `public/logos/integrations/` by swapping underscores for
 * hyphens: `microsoft_sharepoint` → `microsoft-sharepoint.svg`.
 *
 * Lives in shared/ because both the Connectors settings section and the
 * assistant editor's drive panel render the same rows.
 */
import React from 'react';
import Image from 'next/image';

export const integrationIcon = (integrationId: string, size = 24): React.ReactNode => {
    const logoFile = `${integrationId.replace(/_/g, '-')}.svg`;
    return (
        <Image
            src={`/logos/integrations/${logoFile}`}
            alt=""
            width={size}
            height={size}
            style={{ width: size, height: size, objectFit: 'contain' }}
        />
    );
};

export default integrationIcon;
