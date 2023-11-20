import { Plugin, PluginID } from '@/types/plugin';

console.log(process.env.AUTH0_CLIENT_ID);
console.log(process.env.AUTH0_CLIENT_SECRET);
console.log(process.env.AUTH0_SCOPE);
console.log(process.env.AUTH0_AUDIENCE);
console.log(process.env.AUTH0_SECRET);
export const AUTH0_SECRET=process.env.AUTH0_SECRET;
console.log(AUTH0_SECRET);

export const getEndpoint = (plugin: Plugin | null) => {
  if (!plugin) {
    return 'api/chat';
  }

  if (plugin.id === PluginID.GOOGLE_SEARCH) {
    return 'api/google';
  }

  return 'api/chat';
};
