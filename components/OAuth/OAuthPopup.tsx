import { FC } from 'react';
import { getOauthRedirect } from '@/services/oauthIntegrationsService';


interface Props {
  onClose: () => void;
  integration: string;
}

const OAuthPopup: FC<Props> = ({ onClose, integration }) => {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let location = null;
    try {
      const res = await getOauthRedirect(integration);
      location = res.result.body.Location;
    } catch (e) {
      alert("An error occurred. Please try again.");
      return;
    }

    try {

      const isHttpsUrl = (url: string): boolean => /^https:\/\//.test(url);
      if (isHttpsUrl(location)) {

        const width = 600;
        const height = 600;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;

        const authWindow = window.open(
          location,
          'Auth Window',
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
        );

        if (authWindow) {
          authWindow.focus();
        }
      } else {
        alert("An error occurred. Please try again.");
      }
    } catch (e) {
      alert("An error occurred. Please try again.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Connect Google Account</h2>
        <form onSubmit={handleSubmit}>
          <button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition duration-300"
          >
            Connect
          </button>
        </form>
      </div>
    </div>
  );
};

export default OAuthPopup;