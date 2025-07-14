const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

async function testPptxExtract() {
  const filePath = path.join(__dirname, '../sample.pptx');
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));

  try {
    const response = await axios.post('http://localhost:3000/api/extract-text', form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    console.log('Extraction response:', response.data);
  } catch (error) {
    console.error('Error during extraction:', error.response ? error.response.data : error.message);
  }
}

testPptxExtract();
