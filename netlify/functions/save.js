// Netlify Function: commits markers.json to your GitHub repo
// Set env vars in Netlify: GITHUB_TOKEN, REPO_OWNER, REPO_NAME, BRANCH, FILE_PATH, ALLOW_ORIGIN

import fetch from 'node-fetch';

export const handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': process.env.ALLOW_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors, body: 'Method not allowed' };
  }

  try {
    const { markers, author = {name:'Map Bot', email:'mapbot@example.com'} } = JSON.parse(event.body || '{}');
    if (!markers || !Array.isArray(markers)) {
      return { statusCode: 400, headers: cors, body: 'Missing markers array' };
    }

    const owner  = process.env.REPO_OWNER;
    const repo   = process.env.REPO_NAME;
    const branch = process.env.REPO_BRANCH || 'main';
    const path   = process.env.FILE_PATH || 'markers.json';
    const token  = process.env.GITHUB_TOKEN;

    const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;

    // 1) Get current file SHA (if exists)
    let sha = undefined;
    const getRes = await fetch(`${apiBase}?ref=${encodeURIComponent(branch)}`, {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'netlify-fn' }
    });
    if (getRes.ok) {
      const js = await getRes.json();
      if (js && js.sha) sha = js.sha;
    }

    // 2) Commit new content
    const content = Buffer.from(JSON.stringify(markers, null, 2)).toString('base64');
    const msg = `Update markers.json (${new Date().toISOString()})`;
    const putRes = await fetch(apiBase, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'netlify-fn',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: msg,
        content,
        branch,
        sha,
        committer: author,
        author
      })
    });

    if (!putRes.ok) {
      const txt = await putRes.text();
      return { statusCode: 500, headers: cors, body: `GitHub PUT failed: ${txt}` };
    }

    return { statusCode: 200, headers: cors, body: 'Saved to GitHub' };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: `Error: ${e.message}` };
  }
};
