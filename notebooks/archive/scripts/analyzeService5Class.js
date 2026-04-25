// analyzeService5Class.js — Call Pulse AI Flask 5-class API from Node.js/Express
const axios = require('axios');
const FormData = require('form-data');

const FLASK_URL = process.env.FLASK_URL || 'http://localhost:5000';

async function analyzeMRI(fileBuffer, originalFilename) {
    const formData = new FormData();
    formData.append('mri_image', fileBuffer, {
        filename: originalFilename,
        contentType: 'image/png'
    });

    const response = await axios.post(`${FLASK_URL}/analyze`, formData, {
        headers: formData.getHeaders(),
        timeout: 30000
    });

    return response.data;
    /*
    Returns:
    {
        acdcClass: "MINF",
        acdcName: "Myocardial Infarction",
        threatLevel: "High",
        confidence: 87.45,
        acdcProbabilities: { NOR: 1.2, RV: 4.5, HCM: 6.1, MINF: 87.45, DCM: 0.75 },
        threatProbabilities: { Low: 1.2, Medium: 10.6, High: 88.2 },
        recommendation: "Urgent cardiologist consultation required..."
    }
    */
}

module.exports = { analyzeMRI };