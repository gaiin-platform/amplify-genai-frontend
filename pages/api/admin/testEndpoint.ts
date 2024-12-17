import { NextApiRequest, NextApiResponse } from 'next';

const testEndpoint = async (req: NextApiRequest, res: NextApiResponse) => {
  const { url, key, model } = req.body;

  try {
    const headers = {
      'Content-Type': 'application/json',
    //   'Authorization': 'Bearer ' + key, 
      'api-key': key,
    };

    const response = await fetch(url, {
      method: 'POST', // Adjust the method as needed
      headers,
      body: JSON.stringify(
        {
            max_tokens: 50,
            temperature: 1,
            top_p: 1,
            n: 1,
            stream: false,
            model: model,
            messages: [
              {
                role: "user",
                content: "This is a test. Say Hi!",
              },
            ],
          }
      ),
    });

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
