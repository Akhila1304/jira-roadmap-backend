const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

app.get('/jira-versions', async (req, res) => {
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;
  const jiraUrl = 'https://camascope.atlassian.net/rest/api/3/project/CR/versions';

  const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');

  try {
    const response = await axios.get(jiraUrl, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
    });

    const versions = response.data.map(v => ({
      name: v.name,
      releaseDate: v.releaseDate,
    }));

    res.json(versions);
  } catch (error) {
    console.error('Error fetching Jira versions:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch Jira data' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
