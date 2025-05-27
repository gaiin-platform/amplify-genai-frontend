import { FC } from 'react';
import { Modal } from '../ReusableComponents/Modal';
import { integrationIconComponents } from '@/types/integrations';
import { IntegrationsTab } from './IntegrationsTab';

export const translateIntegrationIcon = (icon: string) => {
  if (icon in integrationIconComponents) {
      const IconComponent = integrationIconComponents[icon as keyof typeof integrationIconComponents];
      return <IconComponent className="w-6 h-6 mr-2" />;
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
      content={ <IntegrationsTab open={open} /> }
    />
  );
};