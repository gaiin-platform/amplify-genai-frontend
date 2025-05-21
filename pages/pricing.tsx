import React from 'react';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

import PricingPage from '@/components/Pricing/PricingPage';

const Pricing: React.FC = () => {
  const { t } = useTranslation('common');

  return (
    <div>
      <Head>
        <title>Pricing - AI Assistant Platform</title>
        <meta name="description" content="Choose the perfect plan for your AI assistant needs. Flexible pricing that scales with your business." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <PricingPage />
    </div>
  );
};

export default Pricing;

export const getServerSideProps: GetServerSideProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale ?? 'en', [
        'common',
        'chat',
        'sidebar',
        'markdown',
        'promptbar',
        'settings',
      ])),
    },
  };
};