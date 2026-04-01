import { put, list } from '@vercel/blob';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // List uploaded files
    const { blobs } = await list({ prefix: 'uploads/' });
    return res.json(
      blobs.map(b => ({
        name: b.pathname.replace('uploads/', ''),
        url: b.url,
        size: b.size,
        uploadedAt: b.uploadedAt,
      }))
    );
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'GET or POST only' });
  }

  const filename = req.headers['x-filename'];
  if (!filename) {
    return res.status(400).json({ error: 'Missing x-filename header' });
  }

  const blob = await put(`uploads/${filename}`, req, {
    access: 'public',
    addRandomSuffix: true,
  });

  return res.json({ url: blob.url, pathname: blob.pathname });
}
