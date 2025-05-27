require('dotenv').config();
const multer = require('multer');
const axios = require('axios')
const upload = multer();
const db = require('../utils/database');
const logger = require('../utils/logger');

const baseURL = process.env.PINGVIN_URI;
const systemCredentials = {
  email: process.env.PINGVIN_EMAIL,
  password: process.env.PINGVIN_PASS,
  username: process.env.PINGVIN_USERNAME
};
let accessToken = null;
let refreshToken = null;
let cookies = null;

function getCookieString() {
  return cookies || '';
}

function parseUserIdFromToken(accessToken) {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64'));
    return payload.sub; // sub = user UUID
  } catch (error) {
    throw new Error('Invalid access token');
  }
}

async function signUp() {
  try {
    const response = await fetch(`${baseURL}/auth/signUp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: systemCredentials.email,
        username: systemCredentials.username,
        password: systemCredentials.password
      })
    });

    const data = await response.json().catch(() => ({}));
    if (response.status === 201) {
      accessToken = data.accessToken;
      refreshToken = data.refreshToken;
      cookies = response.headers.get('set-cookie');
      console.error('SignUp success:', response.status, data);
      return true;
    }
    
    console.error('SignUp Failed:', response.status, data);
    return false;
    
  } catch (error) {
    console.error('SignUp Failed:', error);
    return false;
  }
}

async function signIn() {
  try {
    const response = await fetch(`${baseURL}/auth/signIn`, {
      method: 'POST',
      headers: 
      { 
        'Content-Type': 'application/json',
        'Cookie': getCookieString() 
    },
      body: JSON.stringify({
        email: systemCredentials.email,
        password: systemCredentials.password
      })
    });

    const data = await response.json().catch(() => ({}));
    if (response.status === 200) {
      accessToken = data.accessToken;
      refreshToken = data.refreshToken;
      cookies = response.headers.get('set-cookie');
      console.error('SignIn success:', response.status, data);
      return true;
    }
    console.error('SignIn Failed:', response.status, data);
    return false;
  } catch (error) {
    console.error('SignIn Failed:', error);
    return false;
  }
}

async function uploadLogo(fileBuffer, fileName) {
     if (!cookies && !(await authenticate())) {
    throw new Error('Authentication failed');
  }

  const userId = parseUserIdFromToken(accessToken);

  const shareId = `logo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const createResponse = await fetch(`${baseURL}/shares`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': getCookieString(),
      'X-Pingvin-Sync': 'immediate'
    },
    body: JSON.stringify({
      id: shareId,
      expiration: 'never',
      recipients: [],
      security: {},
    })
  });

  if (!createResponse.ok) {
    const error = await createResponse.json().catch(() => ({}));
    throw new Error(`Share creation failed: ${error.message || createResponse.status}`);
  }

  
  const uploadUrl = `${baseURL}/shares/${shareId}/files?name=${encodeURIComponent(fileName)}&chunkIndex=0&totalChunks=1`;
  
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Cookie': getCookieString(),
      'Content-Type': 'application/octet-stream',
    },
    body: fileBuffer
  });

  if (!uploadResponse.ok) {
    const error = await uploadResponse.json().catch(() => ({}));
    throw new Error(`File upload failed: ${error.message || uploadResponse.status}`);
  }

  const uploadData = await uploadResponse.json();

const completeResponse = await fetch(`${baseURL}/shares/${shareId}/complete`, {
  method: 'POST',
  headers: { 
    'Cookie': getCookieString(),
  }
});
if (completeResponse.status !== 202) { // Must check for 202
  const error = await completeResponse.json().catch(() => ({}));
  throw new Error(`Share completion failed: ${error.message || completeResponse.status}`);
}

  return {
  shareId,
  fileId: uploadData.id,
  fileName: uploadData.name,
  adminUrl: `${baseURL}/shares/${shareId}/files/${uploadData.id}`,
  publicUrl: `${baseURL}share/${shareId}`,
  directFileUrl: `${baseURL}/shares/${shareId}/files/${uploadData.id}?display=true`
  };

}

async function authenticate() {
  if (!accessToken && !refreshToken) {
    console.log('No tokens found - attempting signup');
    const signupSuccess = await signUp();
    if (!signupSuccess) {
      console.log('Signup failed, attempting signin');
      return await signIn();
    }
    return true;
  }
  
  console.log('Existing tokens found - attempting signin');
  return await signIn();
}

module.exports.logoauthController = async (req, res, next) => {
  try {
    const authResult = await authenticate();
    console.log('Authentication Result:', authResult);
    if (!authResult) {
      return res.status(401).json({ success: false });
    }
    next();
  } catch (error) {
    console.error('Controller Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports.uploadlogoController = upload.single('logo')

module.exports.handleLogoUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const result = await uploadLogo(
      req.file.buffer,
      req.file.originalname
    );

    const infoUrl = process.env.ME_URI
    const userResponse = await axios.get(infoUrl, {
      headers: {
        cookie: req.headers.cookie
      }
    });

    const user = userResponse.data.user;

    const query = `
      INSERT INTO user_logos (user_id, user_email, filename,direct_url, share_id, file_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const { rows } = await db.query(query, [
      user.id,
      user.email,
      req.file.originalname,
      result.directFileUrl,
      result.shareId,
      result.fileId
    ]);

    res.json({
      success: true,
      url: result.directUrl,
      details: result,
      logoInfo: rows[0]
    });

  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
