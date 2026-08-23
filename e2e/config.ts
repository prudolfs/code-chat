export const e2eUser = {
  name: process.env.E2E_USER_NAME ?? 'CodeChat E2E User',
  email: process.env.E2E_USER_EMAIL ?? 'codechat-phase-8@example.com',
  password: process.env.E2E_USER_PASSWORD ?? 'phase-8-password-123',
}

export const e2eProjects = {
  local: {
    name: process.env.E2E_LOCAL_PROJECT_NAME ?? 'Phase 8 local fixture',
    directory: 'fixtures/ingestion/simple-react-project',
  },
  github: {
    name: 'e2e-fixture',
    url: 'https://github.com/code-chat/e2e-fixture',
  },
}

export const e2eQuestions = {
  first: 'How does the fixture render the user name?',
  second: 'Where is authentication required?',
  otherChat: 'Summarize the fixture project.',
  github: 'What does the mocked GitHub repository export?',
}
