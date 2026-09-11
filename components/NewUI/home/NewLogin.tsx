import React from 'react';
import Image from 'next/image';
import { signIn } from 'next-auth/react';
import { IconArrowRight } from '@tabler/icons-react';

export const NewLogin: React.FC = () => {
  return (
    <div
      data-new-ui-login="true"
      className="flex min-h-screen w-full items-center justify-center overflow-hidden bg-[--bg-app] px-4 py-6 sm:px-6"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      <section className="w-full max-w-[620px]" aria-labelledby="new-login-title">
        <div className="flex w-full flex-col items-center rounded-[16px] border border-[--border-subtle] bg-[--bg-composer] px-8 py-12 text-center shadow-sm sm:px-14 sm:py-16">
          <div className="mb-9 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-[--border-subtle] bg-[--bg-raised] shadow-sm">
            <Image src="/amplify-logo.png" alt="Amplify" width={58} height={58} className="rounded-full" priority />
          </div>

          <div className="mb-10">
            <h1
              id="new-login-title"
              className="text-[40px] font-semibold leading-tight text-[--text-primary]"
            >
              Welcome to Amplify
            </h1>
            <p className="mt-4 text-lg leading-8 text-[--text-secondary]">
              Log in with your Vanderbilt account.
            </p>
          </div>

          <button
            onClick={() => signIn('cognito')}
            id="loginButton"
            className="flex h-14 w-full items-center justify-center gap-2.5 rounded-[12px] bg-[--accent] px-5 text-lg font-semibold text-[--accent-fg] transition-colors duration-150 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-[--accent] focus:ring-offset-2 focus:ring-offset-[--bg-composer] active:brightness-90"
            type="button"
          >
            <span>Continue with Vanderbilt</span>
            <IconArrowRight size={19} strokeWidth={2.25} aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  );
};

export default NewLogin;
