const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// 🔐 Jira Auth & Config
const CLOUD_ID = process.env.CLOUD_ID;
const JIRA_BASE_URL = `https://api.atlassian.com/ex/jira/${CLOUD_ID}`;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const STORY_POINT_FIELD = 'customfield_10400';

if (!JIRA_EMAIL || !JIRA_API_TOKEN || !CLOUD_ID) {
  console.error('❌ Missing JIRA_EMAIL, JIRA_API_TOKEN or CLOUD_ID in .env');
  process.exit(1);
}

const JIRA_HEADERS = {
  'Authorization': `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')}`,
  'Accept': 'application/json'
};

// ✅ Health Check
app.get('/', (req, res) => {
  res.json({ message: 'Jira Dashboard Backend is Running' });
});

// 📊 Velocity Trend (based on recent sprints with prefix filter)
app.get('/velocity-trend/:boardId', async (req, res) => {
  const { boardId } = req.params;
  const maxSprints = 20;

  const boardSprintPrefixes = {
    '102': 'emar',
    '357': 'pharm',
    '324': 'sprt',
  };

  const expectedPrefix = boardSprintPrefixes[boardId];

  try {
    const sprintsResp = await axios.get(`${JIRA_BASE_URL}/rest/agile/1.0/board/${boardId}/sprint`, {
      headers: JIRA_HEADERS,
      params: {
        state: 'closed',
        maxResults: maxSprints,
      },
    });

    const allSprints = sprintsResp.data.values;

    const filteredSprints = allSprints
      .filter(sprint => sprint.name.toLowerCase().startsWith(expectedPrefix))
      .slice(-6)
      .reverse();

    const trend = [];

    for (const sprint of filteredSprints) {
      const sprintId = sprint.id;
      const sprintName = sprint.name;

      const issuesResp = await axios.get(`${JIRA_BASE_URL}/rest/agile/1.0/sprint/${sprintId}/issue`, {
        headers: JIRA_HEADERS,
        params: {
          fields: `${STORY_POINT_FIELD},status`
        }
      });

      const issues = issuesResp.data.issues;

      const committedPoints = issues.reduce((sum, issue) => {
        const sp = issue.fields[STORY_POINT_FIELD];
        return sum + (typeof sp === 'number' ? sp : 0);
      }, 0);

      const completedPoints = issues.reduce((sum, issue) => {
        const sp = issue.fields[STORY_POINT_FIELD];
        const isDone = issue.fields.status?.statusCategory?.key === 'done';
        return sum + (isDone && typeof sp === 'number' ? sp : 0);
      }, 0);

      trend.push({ sprintName, committedPoints, completedPoints });
    }

    res.json(trend);
  } catch (error) {
    console.error('❌ Error fetching velocity trend:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch velocity trend' });
  }
});

// 🟢 Unreleased versions
app.get('/jira-versions', async (req, res) => {
  try {
    const response = await axios.get(`${JIRA_BASE_URL}/rest/api/3/project/CR/versions`, {
      headers: JIRA_HEADERS,
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
    console.error('❌ Error fetching Jira versions:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch Jira versions' });
  }
});

// 🟡 Status breakdown for a version
app.get('/jira-statuses/:versionId', async (req, res) => {
  const versionId = req.params.versionId;

  try {
    const jql = `fixVersion = ${versionId}`;
    const searchUrl = `${JIRA_BASE_URL}/rest/api/3/search?jql=${encodeURIComponent(jql)}&fields=status&maxResults=1000`;

    const response = await axios.get(searchUrl, {
      headers: JIRA_HEADERS
    });

    const statusCounts = {};
    const issues = response.data.issues;

    issues.forEach(issue => {
      const status = issue.fields.status.name;
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    res.json(statusCounts);
  } catch (error) {
    console.error('❌ Error fetching issue statuses:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch issue statuses' });
  }
});

// 🔵 Program progress based on version names
app.get('/jira-programs-progress', async (req, res) => {
  try {
    const response = await axios.get(`${JIRA_BASE_URL}/rest/api/3/project/CR/versions`, {
      headers: JIRA_HEADERS
    });

    const filteredVersions = response.data.filter(v => !v.released);
    const programs = {};

    filteredVersions.forEach(v => {
      let category = 'Others';
      const name = v.name.toLowerCase();
      if (name.startsWith('emar')) category = 'EMAR';
      else if (name.startsWith('mobile')) category = 'Mobile';
      else if (name.startsWith('sprt')) category = 'Support Tool';
      else if (name.startsWith('pprt')) category = 'Pharmacy Portal';

      if (!programs[category]) programs[category] = [];

      programs[category].push({
        name: v.name,
        releaseDate: v.releaseDate,
      });
    });

    res.json(programs);
  } catch (error) {
    console.error('❌ Error fetching Jira programs:', error.message);
    res.status(500).json({ error: 'Failed to fetch Jira programs' });
  }
});

// 🚀 Start Server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
