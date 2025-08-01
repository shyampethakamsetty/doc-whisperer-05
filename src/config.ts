const config = {
  API_BASE_URL: process.env.NODE_ENV === 'development' 
    ? 'http://localhost:8000' 
    : 'https://your-api-domain.com',
  ALLOWED_FILE_TYPES: {
    'application/pdf': ['.pdf'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'text/plain': ['.txt'],
    'text/markdown': ['.md']
  }
};

export default config;