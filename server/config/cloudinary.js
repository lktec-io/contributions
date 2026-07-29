'use strict';

require('dotenv').config();
const cloudinary = require('cloudinary').v2;

// Deliberately does NOT throw when env vars are missing (unlike db.js) —
// this is an additive, optional feature and must never prevent the server
// from starting. Config with undefined values is harmless; an actual
// upload attempt would just fail cleanly at that point instead.
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.warn('[cloudinary] CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET not set — logo upload will be unavailable until configured.');
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

const isConfigured = () =>
  !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

module.exports = { cloudinary, isConfigured };
