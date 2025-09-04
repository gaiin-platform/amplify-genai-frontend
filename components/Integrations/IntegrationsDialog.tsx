import { FC } from 'react';
import { Modal } from '../ReusableComponents/Modal';
import { IntegrationTabs } from './IntegrationsTab';
import Image from 'next/image';

export const translateIntegrationIcon = (integrationId: string) => {
  // Convert integration ID to logo filename: replace _ with - and append .svg
  const logoFile = `${integrationId.replace(/_/g, '-')}.svg`;
  
  if (logoFile) {
    return (
      <Image
        src={`/logos/integrations/${logoFile}`}
        alt={`${integrationId} logo`}
        width={24}
        height={24}
        className="w-6 h-6"
      />
    );
  }
  
  return null;
}
interface Props {
  open: boolean;
  onClose: () => void;
}

export const IntegrationsDialog: FC<Props> = ({ open, onClose }) => {

  if (!open) {
    return null;
  }


  return (
    <Modal
      width={() => window.innerWidth * 0.64}
      height={() => window.innerHeight * 0.88}
      title={'Integrations'}
      showCancel={false}
      onCancel={onClose}
      onSubmit={onClose}
      submitLabel={"OK"}
      content={ <IntegrationTabs open={open} /> }
    />
  );
};