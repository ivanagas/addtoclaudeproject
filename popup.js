let orgUuid = '';
let sessionKey = '';

const showMessage = (message, isError = false) => {
  const messageEl = document.getElementById('message');
  messageEl.textContent = message;
  messageEl.className = isError ? 'error' : 'success';
};

// Basic headers needed for all requests
const getBasicHeaders = () => ({
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'cookie': `sessionKey=${sessionKey}`
});

// Helper for content creation request
const getContentHeaders = () => ({
  ...getBasicHeaders(),
  'content-type': 'application/json'
});

// Helper to make API requests
const makeRequest = async (url, options = {}) => {
  try {
    const response = await fetch(url, {
      ...options,
      headers: options.headers || getBasicHeaders()
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    showMessage(error.message, true);
    throw error;
  }
};

// Save form state
const saveFormState = async () => {
  const formState = {
    projectUuid: document.getElementById('project').value,
    fileName: document.getElementById('fileName').value,
    content: document.getElementById('content').value
  };
  await chrome.storage.local.set({ formState });
};

// Load form state and set project if available
const loadFormState = async () => {
  const data = await chrome.storage.local.get('formState');
  if (data.formState) {
    const { fileName, content, projectUuid } = data.formState;
    document.getElementById('fileName').value = fileName || '';
    document.getElementById('content').value = content || '';
    
    // Only set project if it exists in the dropdown
    const projectSelect = document.getElementById('project');
    if (projectUuid && projectSelect.querySelector(`option[value="${projectUuid}"]`)) {
      projectSelect.value = projectUuid;
      // Update project link
      const projectLink = document.getElementById('projectLink');
      projectLink.href = `https://claude.ai/project/${projectUuid}`;
    }
  }
};

// Add input event listeners to save state as user types
document.getElementById('fileName').addEventListener('input', saveFormState);
document.getElementById('content').addEventListener('input', saveFormState);
document.getElementById('project').addEventListener('change', saveFormState);

document.getElementById('project').addEventListener('change', (e) => {
  const projectLink = document.getElementById('projectLink');
  projectLink.href = `https://claude.ai/project/${e.target.value}`;
});

// Save session key and fetch organization
document.getElementById('saveKey').addEventListener('click', async () => {
  try {
    sessionKey = document.getElementById('sessionKey').value.trim();
    
    if (!sessionKey.startsWith('sk-ant-sid')) {
      throw new Error('Invalid session key format');
    }

    // Save to Chrome storage
    await chrome.storage.local.set({ sessionKey });

    // Get organization
    const orgs = await makeRequest('https://claude.ai/api/organizations');
    orgUuid = orgs[0].uuid;

    // Get projects
    const projects = await makeRequest(`https://claude.ai/api/organizations/${orgUuid}/projects`);
    
    // Populate project dropdown
    const select = document.getElementById('project');
    select.innerHTML = projects
      .sort((a, b) => a.name.localeCompare(b.name)) // Sort alphabetically
      .map(project => `<option value="${project.uuid}">${project.name}</option>`)
      .join('');

    // Load saved form state after populating projects
    await loadFormState();
    
    // Set project link (will use saved project if available)
    const projectLink = document.getElementById('projectLink');
    projectLink.href = `https://claude.ai/project/${select.value}`;

    // Hide instructions
    document.getElementById('sessionKeyInstructions').style.display = 'none';

    // Show project form
    document.getElementById('projectForm').style.display = 'block';
    showMessage('Projects loaded successfully!');
  } catch (error) {
    // Show instructions again if there was an error
    document.getElementById('sessionKeyInstructions').style.display = 'block';
    showMessage(error.message, true);
  }
});

// Load saved session key on popup open
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const data = await chrome.storage.local.get('sessionKey');
    if (data.sessionKey) {
      document.getElementById('sessionKey').value = data.sessionKey;

      // If we have a session key, try to load projects automatically
      document.getElementById('saveKey').click();
    }
  } catch (error) {
    showMessage(error.message, true);
  }
});

// Handle form submission
document.getElementById('submit').addEventListener('click', async () => {
  try {
    const projectUuid = document.getElementById('project').value;
    const fileName = document.getElementById('fileName').value.trim();
    const content = document.getElementById('content').value.trim();

    if (!fileName || !content) {
      throw new Error('Please fill in all fields');
    }

    await makeRequest(
      `https://claude.ai/api/organizations/${orgUuid}/projects/${projectUuid}/docs`,
      {
        method: 'POST',
        headers: getContentHeaders(),
        body: JSON.stringify({ file_name: fileName, content })
      }
    );

    // Clear form and saved state
    document.getElementById('fileName').value = '';
    document.getElementById('content').value = '';
    
    await saveFormState();
   
  } catch (error) {
    showMessage(error.message, true);
  }
});