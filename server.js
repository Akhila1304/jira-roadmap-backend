const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

/**
 * Endpoint: GET /jira-versions
 * Description: Fetches all unreleased fix versions from the CR project.
 */
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
      .filter(v => !v.released) // Exclude released versions
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

/**
 * Endpoint: GET /jira-statuses/:versionId
 * Description: Returns the count of each status for issues in the specified fix version.
 */
app.get('/jira-statuses/:versionId', async (req, res) => {
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;
  const versionId = req.params.versionId;
  const jiraUrl = `https://camascope.atlassian.net/rest/api/3/search?jql=fixVersion=${versionId}&fields=status`;
  const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');

  try {
    const response = await axios.get(jiraUrl, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
    });

    const issues = response.data.issues;

    // Count statuses dynamically
    const statusCounts = {};
    issues.forEach(issue => {
      const statusName = issue.fields.status.name;
      statusCounts[statusName] = (statusCounts[statusName] || 0) + 1;
    });

    res.json(statusCounts);
  } catch (error) {
    console.error('Error fetching Jira issue statuses:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch Jira issue statuses' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

