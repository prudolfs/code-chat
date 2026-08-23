export const readmeGifUser = {
  name: process.env.README_GIF_USER_NAME ?? 'CodeChat README User',
  email: process.env.README_GIF_USER_EMAIL ?? 'codechat-readme-gif@example.com',
  password: process.env.README_GIF_USER_PASSWORD ?? 'readme-gif-password-123',
}

export const readmeGifProjects = [
  {
    name: 'React starter',
    directory: 'fixtures/ingestion/simple-react-project',
  },
  {
    name: 'Python utility',
    directory: 'fixtures/ingestion/project-with-unsupported-files',
  },
  {
    name: 'Generated file example',
    directory: 'fixtures/ingestion/project-with-generated-files',
  },
]
