// netlify/functions/save.js
// Commits markers.json to GitHub. Requires env vars:
// GITHUB_TOKEN, REPO_OWNER, REPO_NAME, REPO_BRANCH, FILE_PATH, ALLOW_ORIGIN

export const handler = async (event) => {
  const origin = event.headers.origin || "";
  const allowOrigin = process.env.ALLOW_ORIGIN || "*";
  const cors = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: "Method not allowed" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const markers = body.markers;
    const author = body.author || { name: "Map Bot", email: "mapbot@example.com" };
    if (!Array.isArray(markers)) {
      return { statusCode: 400, headers: cors, body: "Missing markers array" };
    }

    const owner  = process.env.REPO_OWNER;
    const repo   = process.env.REPO_NAME;
    const branch = process.env.REPO_BRANCH || "main";
    const path   = process.env.FILE_PATH || "markers.json";
    const token  = process.env.GITHUB_TOKEN;

    if (!owner || !repo || !token) {
      return { statusCode: 500, headers: cors, body: "Missing env vars (owner/repo/token)" };
    }

    const apiBase = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}`;

    // 1) get current file sha (if it exists)
    let sha = undefined;
    const getRes = await fetch(`${apiBase}?ref=${encodeURIComponent(branch)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    });
    if (getRes.ok) {
      const js = await getRes.json();
      sha = js?.sha;
    } else if (getRes.status !== 404) {
      const txt = await getRes.text();
      return { statusCode: 500, headers: cors, body: `GitHub GET failed: ${getRes.status} ${txt}` };
    }

    // 2) commit new content
    const content = Buffer.from(JSON.stringify(markers, null, 2)).toString("base64");
    const message = `Update ${path} (${new Date().toISOString()})`;

    const putRes = await fetch(apiBase, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, content, branch, sha, committer: author, author }),
    });

    if (!putRes.ok) {
      const txt = await putRes.text();
      return { statusCode: 500, headers: cors, body: `GitHub PUT failed: ${putRes.status} ${txt}` };
    }

    return { statusCode: 200, headers: cors, body: "Saved to GitHub" };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: `Error: ${e.message}` };
  }
};
