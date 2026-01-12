import { randomBytes } from 'crypto';
import prisma from '../utils/prisma.js';
import QRCode from 'qrcode';
import { getSiteUrl } from '../utils/siteUrl.js';

/**
 * Generate a secure download token for booth photos
 */
export async function generateBoothDownloadToken(mediaId: string): Promise<string> {
  // Check if token already exists
  const existing = await prisma.boothDownloadToken.findUnique({
    where: { mediaId },
  });

  if (existing && existing.expiresAt > new Date() && !existing.used) {
    return existing.token;
  }

  // Generate secure random token
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiration

  // Create or update token
  await prisma.boothDownloadToken.upsert({
    where: { mediaId },
    create: {
      mediaId,
      token,
      expiresAt,
    },
    update: {
      token,
      expiresAt,
      used: false,
      usedAt: null,
    },
  });

  return token;
}

/**
 * Generate QR code for booth photo download
 */
export async function generateBoothDownloadQR(mediaId: string): Promise<string> {
  const token = await generateBoothDownloadToken(mediaId);
  const siteUrl = getSiteUrl();
  const downloadUrl = `${siteUrl}/booth/download/${token}`;
  
  // Generate QR code as data URL
  const qrCodeData = await QRCode.toDataURL(downloadUrl, {
    width: 300,
    margin: 2,
    color: {
      dark: '#1a1a2e',
      light: '#ffffff',
    },
  });

  return qrCodeData;
}

/**
 * Verify and use download token
 */
export async function verifyBoothDownloadToken(token: string): Promise<{ mediaId: string; filePath: string } | null> {
  const downloadToken = await prisma.boothDownloadToken.findUnique({
    where: { token },
    include: {
      media: {
        select: {
          id: true,
          filePath: true,
          fileName: true,
          type: true,
          captureMode: true,
        },
      },
    },
  });

  if (!downloadToken) {
    return null;
  }

  // Check if token is expired
  if (downloadToken.expiresAt < new Date()) {
    return null;
  }

  // Check if token has been used
  if (downloadToken.used) {
    return null;
  }

  // Check if media is from booth mode
  if (downloadToken.media.captureMode !== 'BOOTH') {
    return null;
  }

  // Mark token as used
  await prisma.boothDownloadToken.update({
    where: { id: downloadToken.id },
    data: {
      used: true,
      usedAt: new Date(),
    },
  });

  return {
    mediaId: downloadToken.media.id,
    filePath: downloadToken.media.filePath,
  };
}

