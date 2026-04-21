import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

const testEndpoint = async (req: NextApiRequest, res: NextApiResponse) => {
  // Authentication check - matches pattern used in requestOp.ts and other secure endpoints
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { url, key, body } = req.body;

  // URL validation to prevent SSRF attacks
  try {
    const parsedUrl = new URL(url);

    // Block private IP ranges and local addresses
    const hostname = parsedUrl.hostname;
    const blockedPatterns = [
      /^127\./,                           // Localhost (127.0.0.0/8)
      /^10\./,                            // Private Class A (10.0.0.0/8)
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // Private Class B (172.16.0.0/12)
      /^192\.168\./,                      // Private Class C (192.168.0.0/16)
      /^169\.254\./,                      // Link-local / AWS metadata (169.254.0.0/16)
      /^::1$/,                            // IPv6 localhost
      /^fc00:/,                           // IPv6 private (fc00::/7)
      /^fe80:/,                           // IPv6 link-local (fe80::/10)
      /localhost/i,                       // Localhost hostname
    ];

    if (blockedPatterns.some(pattern => pattern.test(hostname))) {
      return res.status(400).json({
        success: false,
        error: 'Access to private/internal addresses is not allowed'
      });
    }

    // Only allow HTTPS for external requests (security best practice)
    if (parsedUrl.protocol !== 'https:') {
      return res.status(400).json({
        success: false,
        error: 'Only HTTPS URLs are allowed'
      });
    }
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: 'Invalid URL format'
    });
  }

  try {
    const headers = {
      'Content-Type': 'application/json',
      'api-key': key,
    };

    // Add timeout to prevent resource exhaustion
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Request failed with status: ${response.status}`);
    }

    const data = await response.json();
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error testing endpoint: ', error);
    res.status(500).json({ success: false, error: error });
  }
};

export default testEndpoint;
