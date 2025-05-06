const express = require('express');
const axios = require('axios');
const cors = require('cors');
const cheerio = require('cheerio');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

// 🟢 Endpoint: Fetch unreleased and unarchived Jira versions
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

    const versions = response.data
      .filter(v => !v.released && !v.archived)
      .map(v => ({
        id: v.id,
        name: v.name,
        releaseDate: v.releaseDate,
      }));

    res.json(versions);
  } catch (error) {
    console.error('Error fetching Jira versions:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch Jira versions' });
  }
});

// 🟡 Endpoint: Fetch issue statuses from a Jira version's release report
app.get('/jira-statuses/:versionId', async (req, res) => {
  const versionId = req.params.versionId;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
  const jql = `fixVersion = ${versionId}`;
  const jiraSearchUrl = `https://camascope.atlassian.net/rest/api/3/search?jql=${encodeURIComponent(jql)}&fields=status&maxResults=1000`;

  try {
    const response = await axios.get(jiraSearchUrl, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
    });

    const statusCounts = {};
    const issues = response.data.issues;

    issues.forEach(issue => {
      const status = issue.fields.status.name;
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    res.json(statusCounts);
  } catch (error) {
    console.error('Error fetching issue statuses:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch issue statuses' });
  }
});

// 🔵 Endpoint: Group unreleased fix versions by program category
app.get('/jira-programs-progress', async (req, res) => {
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

    const filteredVersions = response.data.filter(v => !v.released);
    const programs = {};

    filteredVersions.forEach(v => {
      let category = 'Others';
      if (v.name.toLowerCase().startsWith('emar')) category = 'EMAR';
      else if (v.name.toLowerCase().startsWith('mobile')) category = 'Mobile';
      else if (v.name.toLowerCase().startsWith('sprt')) category = 'Support Tool';
      else if (v.name.toLowerCase().startsWith('pprt')) category = 'Pharmacy Portal';

      if (!programs[category]) {
        programs[category] = [];
      }

      programs[category].push({
        name: v.name,
        releaseDate: v.releaseDate,
      });
    });

    res.json(programs);
  } catch (error) {
    console.error('Error fetching Jira programs:', error.message);
    res.status(500).json({ error: 'Failed to fetch Jira programs' });
  }
});

// 🚀 Start the server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
