const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

const email = process.env.JIRA_EMAIL;
const apiToken = process.env.JIRA_API_TOKEN;
const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');

// 1️⃣ Get fix versions
app.get('/jira-versions', async (req, res) => {
  const url = 'https://camascope.atlassian.net/rest/api/3/project/CR/versions';
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
    });

    const versions = response.data
      .filter(v => v.name && v.name.includes('-'))
      .map(v => ({
        name: v.name,
        releaseDate: v.releaseDate,
        released: v.released,
        id: v.id,
      }));

    res.json(versions);
  } catch (error) {
    console.error('Error fetching versions:', error.message);
    res.status(500).json({ error: 'Failed to fetch versions' });
  }
});

// 2️⃣ Get statuses for a version (by versionId)
app.get('/jira-statuses/:versionId', async (req, res) => {
  const versionId = req.params.versionId;
  const url = `https://camascope.atlassian.net/rest/api/3/search?jql=fixVersion=${versionId}&fields=status`;

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
    });

    const issues = response.data.issues;
    const statusCounts = {};

    for (const issue of issues) {
      const statusName = issue.fields.status.name;
      statusCounts[statusName] = (statusCounts[statusName] || 0) + 1;
    }

    res.json(statusCounts);
  } catch (error) {
    console.error(`Error fetching statuses for version ${versionId}:`, error.message);
    res.status(500).json({ error: 'Failed to fetch statuses' });
  }
});

// 3️⃣ Program-level progress (grouped by fixVersion prefix)
app.get('/jira-program-progress', async (req, res) => {
  const versionsUrl = 'https://camascope.atlassian.net/rest/api/3/project/CR/versions';

  try {
    const versionsResponse = await axios.get(versionsUrl, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
    });

    const versions = versionsResponse.data.filter(
      v => !v.released && v.id && v.name.includes('-')
    );

    const programStats = {};

    for (const version of versions) {
      const versionId = version.id;
      const program = version.name.split('-')[0];

      const issuesUrl = `https://camascope.atlassian.net/rest/api/3/search?jql=fixVersion=${versionId}&fields=status`;

      const issuesResponse = await axios.get(issuesUrl, {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
        },
      });

      const issues = issuesResponse.data.issues;

      if (!programStats[program]) {
        programStats[program] = { done: 0, inProgress: 0, todo: 0, total: 0 };
      }

      for (const issue of issues) {
        const status = issue.fields.status.name;
        programStats[program].total += 1;

        if (status.toLowerCase().includes('done')) {
          programStats[program].done += 1;
        } else if (status.toLowerCase().includes('progress')) {
          programStats[program].inProgress += 1;
        } else {
          programStats[program].todo += 1;
        }
      }
    }

    const result = Object.entries(programStats).map(([program, stats]) => ({
      program,
      ...stats,
      completionPercent: ((stats.done / stats.total) * 100).toFixed(1),
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching program progress:', error.message);
    res.status(500).json({ error: 'Failed to fetch program progress' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

